const BaseAccessory = require('./BaseAccessory');

// define constants for Kogan garage door.
// Action
const GARAGE_DOOR_OPEN = 'open';
const GARAGE_DOOR_CLOSE = 'close';
const GARAGE_DOOR_FOPEN = 'fopen';
const GARAGE_DOOR_FCLOSE = 'fclose';

// Status or state
// yes, 'openning' is not a mistake, that's the text from the Kogan opener
const GARAGE_DOOR_OPENED = 'opened';
const GARAGE_DOOR_CLOSED = 'closed';
const GARAGE_DOOR_OPENNING = 'openning';
const GARAGE_DOOR_OPENING =
    'opening'; // 'opening' is not currently a valid value; added in case Kogan
               // one day decides to correct the spelling
const GARAGE_DOOR_CLOSING = 'closing';
// Kogan garage door appears to have no stopped status

// Kogan manufacturer name
const GARAGE_DOOR_MANUFACTURER_KOGAN = 'Kogan';

// Wofea manufacturer name
const GARAGE_DOOR_MANUFACTURER_WOFEA = 'Wofea';

// main code
class GarageDoorAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.GARAGE_DOOR_OPENER;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        this.accessory.addService(Service.GarageDoorOpener, this.device.context.name);

        super._registerPlatformAccessory();
    }

    // function to return a ID string for log messages
    _logPrefix() {
        return '[Tuya] ' +
            (this.manufacturer ? this.manufacturer + ' ' : '') + 'GarageDoor';
    }

    // function to prefix a string ID and always log to console
    _alwaysLog(...args) { console.log(this._logPrefix(), ...args); }

    // function to log to console if debug is on
    _debugLog(...args) {
        if (this.debug) {
            this._alwaysLog(...args);
        }
    }

    // function to return true if the garage door manufacturer is Kogan and false
    // otherwise
    _isKogan() {
        if (this.manufacturer === GARAGE_DOOR_MANUFACTURER_KOGAN.trim()) {
            return true;
        } else {
            return false;
        }
    }

    // function to return true if the garage door manufacturer is Wofea
    _isWofea() {
      if (this.manufacturer === GARAGE_DOOR_MANUFACTURER_WOFEA.trim()) {
          return true;
      } else {
          return false;
      }
  }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const service = this.accessory.getService(Service.GarageDoorOpener);
        this._checkServiceName(service, this.device.context.name);

        // set the debug flag
        if (this.device.context.debug) {
            this.debug = true;
        } else {
            this.debug = false;
        }

        // Set the manufacturer string
        // If the manufacturer string matches a known manufacturer, set to that string
        // Otherwise set the manufacturer to the defined value
        // Otherwise set the manufacturer to a blank string
        if (this.device.context.manufacturer.trim().toLowerCase() ===
            GARAGE_DOOR_MANUFACTURER_KOGAN.trim().toLowerCase()) {
            this.manufacturer = GARAGE_DOOR_MANUFACTURER_KOGAN.trim();
        } else if (this.device.context.manufacturer.trim().toLowerCase() ===
            GARAGE_DOOR_MANUFACTURER_WOFEA.trim().toLowerCase()) {
            this.manufacturer = this.device.context.manufacturer.trim();
        } else if (this.device.context.manufacturer) {
            this.manufacturer = this.device.context.manufacturer.trim();
        } else {
            this.manufacturer = '';
        }
        // set the dpAction and dpStatus values based on the manufacturer
        if (this._isKogan()) {
            // Kogan SmarterHome Wireless Garage Door Opener
            this._debugLog(
                '_registerCharacteristics setting dpAction and dpStatus for ' +
                GARAGE_DOOR_MANUFACTURER_KOGAN + ' garage door');
            this.dpAction = this._getCustomDP(this.device.context.dpAction) || '101';
            this.dpStatus = this._getCustomDP(this.device.context.dpStatus) || '102';
        } else if (this._isWofea()) {
            // Wofea Wifi Switch Smart Garage Door Opener
            this._debugLog(
                '_registerCharacteristics setting dpAction and dpStatus for ' +
                GARAGE_DOOR_MANUFACTURER_WOFEA + ' garage door');
            this.dpAction = this._getCustomDP(this.device.context.dpAction) || '1';
            this.dpStatus = this._getCustomDP(this.device.context.dpStatus) || '101';
        } else {
            // the original garage door opener
            this._debugLog(
                '_registerCharacteristics setting dpAction and dpStatus for generic door');
            this.dpAction = this._getCustomDP(this.device.context.dpAction) || '1';
            this.dpStatus = this._getCustomDP(this.device.context.dpStatus) || '2';
        }

        this.currentOpen = Characteristic.CurrentDoorState.OPEN;
        this.currentOpening = Characteristic.CurrentDoorState.OPENING;
        this.currentClosing = Characteristic.CurrentDoorState.CLOSING;
        this.currentClosed = Characteristic.CurrentDoorState.CLOSED;
        this.currentStopped = Characteristic.CurrentDoorState.STOPPED;
        this.targetOpen = Characteristic.TargetDoorState.OPEN;
        this.targetClosed = Characteristic.TargetDoorState.CLOSED;
        if (!!this.device.context.flipState) {
            this.currentOpen = Characteristic.CurrentDoorState.CLOSED;
            this.currentOpening = Characteristic.CurrentDoorState.CLOSING;
            this.currentClosing = Characteristic.CurrentDoorState.OPENING;
            this.currentClosed = Characteristic.CurrentDoorState.OPEN;
            this.targetOpen = Characteristic.TargetDoorState.CLOSED;
            this.targetClosed = Characteristic.TargetDoorState.OPEN;
        }

        const characteristicTargetDoorState = service.getCharacteristic(Characteristic.TargetDoorState)
            .updateValue(this._getTargetDoorState(dps[this.dpStatus]))
            .on('get', this.getTargetDoorState.bind(this))
            .on('set', this.setTargetDoorState.bind(this));

        const characteristicCurrentDoorState = service.getCharacteristic(Characteristic.CurrentDoorState)
            .updateValue(this._getCurrentDoorState(dps[this.dpStatus]))
            .on('get', this.getCurrentDoorState.bind(this));

        this.device.on('change', changes => {
            this._alwaysLog('changed:' + JSON.stringify(changes));

            if (changes.hasOwnProperty(this.dpStatus)) {
                const newCurrentDoorState =
                    this._getCurrentDoorState(changes[this.dpStatus]);
                this._debugLog('on change new and old CurrentDoorState ' +
                    newCurrentDoorState + ' ' +
                    characteristicCurrentDoorState.value);
                this._debugLog('on change old characteristicTargetDoorState ' +
                    characteristicTargetDoorState.value);

                if (newCurrentDoorState == this.currentOpen &&
                    characteristicTargetDoorState.value !== this.targetOpen)
                    characteristicTargetDoorState.updateValue(this.targetOpen);

                if (newCurrentDoorState == this.currentClosed &&
                    characteristicTargetDoorState.value !== this.targetClosed)
                    characteristicTargetDoorState.updateValue(this.targetClosed);

                if (characteristicCurrentDoorState.value !== newCurrentDoorState) characteristicCurrentDoorState.updateValue(newCurrentDoorState);
            }
        });
    }

    getTargetDoorState(callback) {
        this.getState(this.dpStatus, (err, dp) => {
            if (err) return callback(err);

            this._debugLog('getTargetDoorState dp ' + JSON.stringify(dp));

            callback(null, this._getTargetDoorState(dp));
        });
    }

    _getTargetDoorState(dp) {
        this._debugLog('_getTargetDoorState dp ' + JSON.stringify(dp));

        if (this._isKogan()) {
            // translate the Kogan strings to the enumerated status values
            switch (dp) {
                case GARAGE_DOOR_OPENED:
                case GARAGE_DOOR_OPENNING:
                case GARAGE_DOOR_OPENING:
                    return this.targetOpen;

                case GARAGE_DOOR_CLOSED:
                case GARAGE_DOOR_CLOSING:
                    return this.targetClosed;

                default:
                    this._alwaysLog('_getTargetDoorState UNKNOWN STATE ' +
                        JSON.stringify(dp));
            }
        } else {
            // Generic garage door uses true for the opened status and false for the
            // closed status
            if (dp === true) {
                return this.targetOpen;
            } else if (dp === false) {
                return this.targetClosed;
            } else {
                this._alwaysLog('_getTargetDoorState UNKNOWN STATE ' +
                    JSON.stringify(dp));
            }
        }
    }

    setTargetDoorState(value, callback) {
        var newValue = GARAGE_DOOR_CLOSE;
        this._debugLog('setTargetDoorState value ' + value + ' targetOpen ' +
            this.targetOpen + ' targetClosed ' + this.targetClosed);

        if (this._isKogan()) {
            // translate the the enumerated status values to Kogan strings
            switch (value) {
                case this.targetOpen:
                    newValue = GARAGE_DOOR_OPEN;
                    break;

                case this.targetClosed:
                    newValue = GARAGE_DOOR_CLOSE;
                    break;

                default:
                    this._alwaysLog('setTargetDoorState UNKNOWN STATE ' +
                        JSON.stringify(value));
            }
        } else {
            // Generic garage door uses true for the open action and false for the
            // close action
            switch (value) {
                case this.targetOpen:
                    newValue = true;
                    break;

                case this.targetClosed:
                    newValue = false;
                    break;

                default:
                    this._alwaysLog('setTargetDoorState UNKNOWN STATE ' +
                        JSON.stringify(value));
            }
        }

        this.setState(this.dpAction, newValue, callback);
    }

    getCurrentDoorState(callback) {
        this.getState(this.dpStatus, (err, dpStatusValue) => {
            if (err) return callback(err);

            callback(null, this._getCurrentDoorState(dpStatusValue));
        });
    }

    _getCurrentDoorState(dpStatusValue) {
        this._debugLog('_getCurrentDoorState dpStatusValue ' +
            JSON.stringify(dpStatusValue));

        if (this._isKogan()) {
            // translate the Kogan strings to the enumerated status values
            switch (dpStatusValue) {
                case GARAGE_DOOR_OPENED:
                    return this.currentOpen;

                case GARAGE_DOOR_OPENNING:
                case GARAGE_DOOR_OPENING:
                    return this.currentOpening;

                case GARAGE_DOOR_CLOSING:
                    return this.currentClosing;

                case GARAGE_DOOR_CLOSED:
                    return this.currentClosed;

                default:
                    this._alwaysLog('_getCurrentDoorState UNKNOWN STATUS ' +
                        JSON.stringify(dpStatusValue));
            }
        } else {
            // Generic garage door uses true for the open status and false for the
            // close status. It doesn't seem to have other values for opening and
            // closing. If the getState() function callback in BaseAccessory.js passed
            // the dps object into this function, we may be able to infer opening and
            // closing from the combined dpStatus and dpAction values. That would
            // require mods to every accessory that used that callback. Not worth it.
            if (dpStatusValue === true) {
                // dpStatus true corresponds to an open door
                return this.currentOpen;
            } else if (dpStatusValue === false) {
                // dpStatus false corresponds to a closed door, so assume "not open"
                return this.currentClosed;
            } else {
                this._alwaysLog('_getCurrentDoorState UNKNOWN STATUS ' +
                    JSON.stringify(dpStatusValue));
            }
        }
    }
}

module.exports = GarageDoorAccessory;
