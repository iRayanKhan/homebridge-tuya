const BaseAccessory = require('./BaseAccessory');

const BLINDS_CMD_OPEN = 'open';
const BLINDS_CMD_CLOSE = 'close';
const BLINDS_CMD_STOP = 'stop';

const DEVICE_POSITION_OPEN = 0;
const DEVICE_POSITION_CLOSE = 100;
const HOMEKIT_POSITION_OPEN = 100;
const HOMEKIT_POSITION_CLOSE = 0;

const BLINDS_DP_CONTROL = 1;
const BLINDS_DP_POSITION = 2;

const POSITION_UPDATE_TIMEOUT = 60 * 1000;

class SimpleBlinds3Accessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.WINDOW_COVERING;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        this.accessory.addService(Service.WindowCovering, this.device.context.name);

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const service = this.accessory.getService(Service.WindowCovering);
        this._checkServiceName(service, this.device.context.name);

        this.dpControl = this._getCustomDP(this.device.context.dpControl) || BLINDS_DP_CONTROL;
        this.dpPosition = this._getCustomDP(this.device.context.dpPosition) || BLINDS_DP_POSITION;

        this.cmdOpen = BLINDS_CMD_OPEN;
        if (this.device.context.cmdOpen) {
            this.cmdOpen = ('' + this.device.context.cmdOpen).trim();
        }

        this.cmdClose = BLINDS_CMD_CLOSE;
        if (this.device.context.cmdClose) {
            this.cmdClose = ('' + this.device.context.cmdClose).trim();
        }

        this.cmdStop = BLINDS_CMD_STOP;
        if (this.device.context.cmdStop) {
            this.cmdStop = ('' + this.device.context.cmdStop).trim();
        }

        this.positionUpdateTimeoutDuration = parseInt(this.device.context.positionUpdateTimeout) || POSITION_UPDATE_TIMEOUT;

        // Initialize position and state (assume target and current are equal at start).
        this.targetPosition = this.currentPosition = this._getCurrentPosition(dps[this.dpPosition]);
        this.commandedState = dps[this.dpControl];
        this.targetRecentlyChanged = false;

        const characteristicCurrentPosition = service.getCharacteristic(Characteristic.CurrentPosition)
            .updateValue(this.currentPosition)
            .on('get', this.getCurrentPosition.bind(this));

        const characteristicTargetPosition = service.getCharacteristic(Characteristic.TargetPosition)
            .updateValue(this.currentPosition)
            .on('get', this.getTargetPosition.bind(this))
            .on('set', this.setTargetPosition.bind(this));

        const characteristicPositionState = service.getCharacteristic(Characteristic.PositionState)
            .updateValue(this._getPositionState(Characteristic.PositionState.STOPPED))
            .on('get', this.getPositionState.bind(this));

        this.device.on('change', changes => {
            if (changes.hasOwnProperty(this.dpControl) && this.commandedState !== changes[this.dpControl]) {
                this.commandedState = changes[this.dpControl];
                console.log("[TuyaAccessory] SimpleBlinds3 " + this.device.context.name + " commanded to " + this.commandedState);

                switch (this.commandedState) {
                    case this.cmdOpen:
                        characteristicPositionState.updateValue(Characteristic.PositionState.DECREASING);
                        this.targetPosition = HOMEKIT_POSITION_OPEN;
                        break;
                    case this.cmdClose:
                        characteristicPositionState.updateValue(Characteristic.PositionState.INCREASING);
                        this.targetPosition = HOMEKIT_POSITION_CLOSE;
                        break;
                    case this.cmdStop:
                        if (changes.hasOwnProperty(this.dpPosition)) {
                            characteristicPositionState.updateValue(this._getPositionState(this.currentPosition));
                        }
                        break;
                }
                characteristicTargetPosition.updateValue(this.targetPosition);

                if (this.positionUpdateTimeout) {
                    clearTimeout(this.positionUpdateTimeout);
                    delete this.positionUpdateTimeout;
                }

                this.positionUpdateTimeout = setTimeout(() => {
                    this.getCurrentPosition((unused, position) => {
                        // If we've can't read position, assume success at reaching target position.
                        if (isNaN(position)) { position = this.targetPosition; }

                        console.log("[TuyaAccessory] SimpleBlinds3 " + this.device.context.name + " resetting position to " + position + " after timeout.");
                        characteristicPositionState.updateValue(Characteristic.PositionState.STOPPED);
                        characteristicCurrentPosition.updateValue(position);
                        characteristicTargetPosition.updateValue(position);
                    });
                }, this.positionUpdateTimeoutDuration);

            } else if (changes.hasOwnProperty(this.dpPosition) && !this.targetRecentlyChanged) {
                console.log("[TuyaAccessory] SimpleBLinds3 " + this.device.context.name + " saw change to " + changes[this.dpPosition]);
                this.currentPosition = this._getCurrentPosition(changes[this.dpPosition]);
                characteristicCurrentPosition.updateValue(this.currentPosition);

                if (this.currentPosition === this.targetPosition) {
                    characteristicPositionState.updateValue(Characteristic.PositionState.STOPPED);
                    if (this.positionUpdateTimeout) {
                        clearTimeout(this.positionUpdateTimeout);
                        delete this.positionUpdateTimeout;
                    }
                }
            } else {
                console.log("[TuyaAccessory] SimpleBlinds3 " + this.device.context.name + " skipping message (likely due to recent target change): " + JSON.stringify(changes));
            }
        });
    }

    getCurrentPosition(callback) {
        this.getState(this.dpAction, (err, dp) => {
            if (err) return callback(err);

            this.currentPosition = this._getCurrentPosition(dp);
            callback(null, this.currentPosition);
        });
    }

    _getCurrentPosition(dp) {
        // Device counts percent closed; HomeKit counts percent open.
        return DEVICE_POSITION_CLOSE - dp;
    }

    getTargetPosition(callback) {
        process.nextTick(() => {
            callback(null, this.targetPosition);
        });
    }

    setTargetPosition(value, callback) {
        console.log('[TuyaAccessory] SimpleBlinds3 ' + this.device.context.name + ' target position set to ' + value);

        this.targetPosition = value;

        // Since target will be sent to the same dp as current position is read from,
        // we set a flag to ignore reports of this change briefly to avoid confusing HomeKit.
        this.targetRecentlyChanged = true;
        setTimeout(() => { this.targetRecentlyChanged = false; }, 2 * 1000);

        // Device counts percent closed; HomeKit counts percent open
        const commandPosition = DEVICE_POSITION_CLOSE - this.targetPosition;

        // Device expects open or close commands only, or stop with a position for partial open/close.
        const commandDps = (() => {
            switch (commandPosition) {
                case DEVICE_POSITION_OPEN:
                    return {
                        [this.dpControl.toString()]: this.cmdOpen
                    };
                    break;
                case DEVICE_POSITION_CLOSE:
                    return {
                        [this.dpControl.toString()]: this.cmdClose
                    };
                    break;
                default:
                    return {
                        [this.dpControl.toString()]: this.cmdStop,
                        [this.dpPosition.toString()]: commandPosition
                    };
            }
        })();

        return this.setMultiState(commandDps, callback);
    }

    getPositionState(callback) {
        this.getState(this.dpPosition, (err, dp) => {
            if (err) return callback(err);

            this.currentPosition = this._getCurrentPosition(dp);
            callback(null, this._getPositionState(this.currentPosition));
        });
    }

    _getPositionState(currentPosition) {
        const {Characteristic} = this.hap;

        if (!this.targetPosition) {
            return Characteristic.PositionState.STOPPED;
        }

        if (this.targetPosition > currentPosition) {
            return Characteristic.PositionState.INCREASING;
        } else if (this.targetPosition < currentPosition) {
            return Characteristic.PositionState.DECREASING;
        } else {
            return Characteristic.PositionState.STOPPED;
        }
    }

}

module.exports = SimpleBlinds3Accessory;
