const BaseAccessory = require('./BaseAccessory');

const BLINDS_OPENING = 'opening';
const BLINDS_CLOSING = 'closing';
const BLINDS_STOPPED = 'stopped';

const BLINDS_OPEN = 100;
const BLINDS_CLOSED = 0;

class SimpleBlindsAccessory extends BaseAccessory {
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
        this.dpBlindType = parseInt(this.device.context.dpBlindType) || 1;
        this.dpAction = this._getCustomDP(this.device.context.dpAction) || '1';

        //setting the defaults if no one declares anything.
        this.OPEN_COMMAND = '';
        this.CLOSE_COMMAND = '';
        this.STOP_COMMAND = '';

        if(this.dpBlindType === 1)
        {
          this.log.debug("Blinds Type 1 Selected");
          this.OPEN_COMMAND = 'open';
          this.CLOSE_COMMAND = 'close';
          this.STOP_COMMAND = 'stop';
        } else if (this.dpBlindType === 2)
        {
          this.log.debug("Blinds Type 2 Detected");
          this.OPEN_COMMAND = 'on';
          this.CLOSE_COMMAND = 'off';
          this.STOP_COMMAND = 'stop';

        } else if (this.dpBlindType === 3) {
          this.log.debug("Blinds Type 3 Selected");
          //this one here should fix https://github.com/iRayanKhan/homebridge-tuya/issues/444 when the type is set to 0
          this.OPEN_COMMAND = '1';
          this.CLOSE_COMMAND = '2';
          this.STOP_COMMAND = '3';
        }

        let _cmdOpen = this.OPEN_COMMAND;
        if (this.device.context.cmdOpen) {
            _cmdOpen = ('' + this.device.context.cmdOpen).trim();
        }
        let _cmdClose = this.CLOSE_COMMAND;

        if (this.device.context.cmdClose) {
            _cmdClose = ('' + this.device.context.cmdClose).trim();
        }

        let _cmdStop = this.STOP_COMMAND;
        if (this.device.context.cmdStop) {
            _cmdStop = ('' + this.device.context.cmdStop).trim();
        }

        this.cmdStop = _cmdStop;
        this.cmdOpen = _cmdOpen;
        this.cmdClose = _cmdClose;
        if (!!this.device.context.flipState) {
            this.cmdOpen = _cmdClose;
            this.cmdClose = _cmdOpen;
        }

        this.duration = parseInt(this.device.context.timeToOpen) || 45;
        const endingDuration = parseInt(this.device.context.timeToTighten) || 0;
        this.minPosition = endingDuration ? Math.round(endingDuration * -100 / (this.duration - endingDuration)) : BLINDS_CLOSED;

        // If the blinds are closed, note it; if not, assume open because there is no way to know where it is
        this.assumedPosition = dps[this.dpAction] === this.cmdClose ? this.minPosition : BLINDS_OPEN;
        this.assumedState = BLINDS_STOPPED;
        this.changeTime = this.targetPosition = false;

        const characteristicCurrentPosition = service.getCharacteristic(Characteristic.CurrentPosition)
            .updateValue(this._getCurrentPosition(dps[this.dpAction]))
            .on('get', this.getCurrentPosition.bind(this));

        const characteristicTargetPosition = service.getCharacteristic(Characteristic.TargetPosition)
            .updateValue(this._getTargetPosition(dps[this.dpAction]))
            .on('get', this.getTargetPosition.bind(this))
            .on('set', this.setTargetPosition.bind(this));

        const characteristicPositionState = service.getCharacteristic(Characteristic.PositionState)
            .updateValue(this._getPositionState())
            .on('get', this.getPositionState.bind(this));

        this.device.on('change', changes => {
            this.log.debug("[TuyaAccessory] Blinds saw change to " + changes[this.dpAction]);
            if (changes.hasOwnProperty(this.dpAction)) {
                switch (changes[this.dpAction]) {
                    case this.cmdOpen:  // Starting to open
                        this.assumedState = BLINDS_OPENING;
                        characteristicPositionState.updateValue(Characteristic.PositionState.INCREASING);

                        // Only if change was external or someone internally asked for open
                        if (this.targetPosition === false || this.targetPosition === BLINDS_OPEN) {
                            this.targetPosition = false;

                            const durationToOpen = Math.abs(this.assumedPosition - BLINDS_OPEN) * this.duration * 10;
                            this.changeTime = Date.now() - durationToOpen;

                            this.log.debug("[TuyaAccessory] Blinds will be marked open in " + durationToOpen + "ms");

                            if (this.changeTimeout) clearTimeout(this.changeTimeout);
                            this.changeTimeout = setTimeout(() => {
                                characteristicCurrentPosition.updateValue(BLINDS_OPEN);
                                characteristicPositionState.updateValue(Characteristic.PositionState.STOPPED);
                                this.changeTime = false;
                                this.assumedPosition = BLINDS_OPEN;
                                this.assumedState = BLINDS_STOPPED;
                                this.log.debug("[TuyaAccessory] Blinds marked open");
                            }, durationToOpen);
                        }
                        break;

                    case this.cmdClose:  // Starting to close
                        this.assumedState = BLINDS_CLOSING;
                        characteristicPositionState.updateValue(Characteristic.PositionState.DECREASING);

                        // Only if change was external or someone internally asked for close
                        if (this.targetPosition === false || this.targetPosition === BLINDS_CLOSED) {
                            this.targetPosition = false;

                            const durationToClose = Math.abs(this.assumedPosition - BLINDS_CLOSED) * this.duration * 10;
                            this.changeTime = Date.now() - durationToClose;

                            this.log.debug("[TuyaAccessory] Blinds will be marked closed in " + durationToClose + "ms");

                            if (this.changeTimeout) clearTimeout(this.changeTimeout);
                            this.changeTimeout = setTimeout(() => {
                                characteristicCurrentPosition.updateValue(BLINDS_CLOSED);
                                characteristicPositionState.updateValue(Characteristic.PositionState.STOPPED);
                                this.changeTime = false;
                                this.assumedPosition = this.minPosition;
                                this.assumedState = BLINDS_STOPPED;
                                this.log.debug("[TuyaAccessory] Blinds marked closed");
                            }, durationToClose);
                        }
                        break;

                    case this.cmdStop:  // Stopped in middle
                        if (this.changeTimeout) clearTimeout(this.changeTimeout);

                        this.log.debug("[TuyaAccessory] Blinds last change was " + this.changeTime + "; " + (Date.now() - this.changeTime) + 'ms ago');

                        if (this.changeTime) {
                            /*
                            this.assumedPosition = Math.min(100 - this.minPosition, Math.max(0, Math.round((Date.now() - this.changeTime) / (10 * this.duration))));
                            if (this.assumedState === BLINDS_CLOSING) this.assumedPosition = 100 - this.assumedPosition;
                            else this.assumedPosition += this.minPosition;
                             */
                            const disposition = ((Date.now() - this.changeTime) / (10 * this.duration));
                            if (this.assumedState === BLINDS_CLOSING) {
                                this.assumedPosition = BLINDS_OPEN - disposition;
                            } else {
                                this.assumedPosition = this.minPosition + disposition;
                            }
                        }

                        const adjustedPosition = Math.max(0, Math.round(this.assumedPosition));
                        characteristicCurrentPosition.updateValue(adjustedPosition);
                        characteristicTargetPosition.updateValue(adjustedPosition);
                        characteristicPositionState.updateValue(Characteristic.PositionState.STOPPED);
                        this.log.debug("[TuyaAccessory] Blinds marked stopped at " + adjustedPosition + "; assumed to be at " + this.assumedPosition);

                        this.changeTime = this.targetPosition = false;
                        this.assumedState = BLINDS_STOPPED;
                        break;
                }
            }
        });
    }

    getCurrentPosition(callback) {
        this.getState(this.dpAction, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getCurrentPosition(dp));
        });
    }

    _getCurrentPosition(dp) {
        switch (dp) {
            case this.cmdOpen:
                return BLINDS_OPEN;

            case this.cmdClose:
                return BLINDS_CLOSED;

            default:
                return Math.max(BLINDS_CLOSED, Math.round(this.assumedPosition));
        }
    }

    getTargetPosition(callback) {
        this.getState(this.dpAction, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getTargetPosition(dp));
        });
    }

    _getTargetPosition(dp) {
        switch (dp) {
            case this.cmdOpen:
                return BLINDS_OPEN;

            case this.cmdClose:
                return BLINDS_CLOSED;

            default:
                return Math.max(BLINDS_CLOSED, Math.round(this.assumedPosition));
        }
    }

    setTargetPosition(value, callback) {
        this.log.debug('[TuyaAccessory] Blinds asked to move from ' + this.assumedPosition + ' to ' + value);

        if (this.changeTimeout) clearTimeout(this.changeTimeout);
        this.targetPosition = value;

        if (this.changeTime !== false) {
            this.log.debug("[TuyaAccessory] Blinds " + (this.assumedState === BLINDS_CLOSING ? 'closing' : 'opening') + " had started " + this.changeTime + "; " + (Date.now() - this.changeTime) + 'ms ago');
            const disposition = ((Date.now() - this.changeTime) / (10 * this.duration));
            if (this.assumedState === BLINDS_CLOSING) {
                this.assumedPosition = BLINDS_OPEN - disposition;
            } else {
                this.assumedPosition = this.minPosition + disposition;
            }
            this.log.debug("[TuyaAccessory] Blinds' adjusted assumedPosition is " + this.assumedPosition);
        }

        const duration = Math.abs(this.assumedPosition - value) * this.duration * 10;

        if (Math.abs(value - this.assumedPosition) < 1) {
            return this.setState(this.dpAction, this.cmdStop, callback);
        } else if (value > this.assumedPosition) {
            this.assumedState = BLINDS_OPENING;
            this.setState(this.dpAction, this.cmdOpen, callback);
            this.changeTime = Date.now() -  Math.abs(this.assumedPosition - this.minPosition) * this.duration * 10;
        } else {
            this.assumedState = BLINDS_CLOSING;
            this.setState(this.dpAction, this.cmdClose, callback);
            this.changeTime = Date.now() -  Math.abs(this.assumedPosition - BLINDS_OPEN) * this.duration * 10;
        }

        if (value !== BLINDS_OPEN && value !== BLINDS_CLOSED) {
            this.log.debug("[TuyaAccessory] Blinds will stop in " + duration + "ms");
            this.log.debug("[TuyaAccessory] Blinds assumed started " + this.changeTime + "; " + (Date.now() - this.changeTime) + 'ms ago');
            this.changeTimeout = setTimeout(() => {
                this.log.debug("[TuyaAccessory] Blinds asked to stop");
                this.setState(this.dpAction, this.cmdStop);
            }, duration);
        }
    }

    getPositionState(callback) {
        const state = this._getPositionState();
        process.nextTick(() => {
            callback(null, state);
        });
    }

    _getPositionState() {
        const {Characteristic} = this.hap;

        switch (this.assumedState) {
            case BLINDS_OPENING:
                return Characteristic.PositionState.INCREASING;

            case BLINDS_CLOSING:
                return Characteristic.PositionState.DECREASING;

            default:
                return Characteristic.PositionState.STOPPED;
        }
    }
}

module.exports = SimpleBlindsAccessory;
