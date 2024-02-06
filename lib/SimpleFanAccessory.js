const BaseAccessory = require('./BaseAccessory');

class SimpleFanAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.FAN;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;
        this.accessory.addService(Service.Fan, this.device.context.name);
        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const serviceFan = this.accessory.getService(Service.Fan);
        this._checkServiceName(serviceFan, this.device.context.name);
        this.dpFanOn = this._getCustomDP(this.device.context.dpFanOn) || '1';
        this.dpRotationSpeed = this._getCustomDP(this.device.context.dpRotationSpeed) || '3';
        this.maxSpeed = parseInt(this.device.context.maxSpeed) || 3;
        // This variable is here so that we can set the fans to turn onto speed one instead of 3 on start.
        this.fanDefaultSpeed = parseInt(this.device.context.fanDefaultSpeed) || 1;
        // This variable is here as a workaround to allow for the on/off function to work.
        this.fanCurrentSpeed = 0;
        // Add setting to use .toString() on return values or not.
        this.useStrings = this._coerceBoolean(this.device.context.useStrings, true);

        const characteristicFanOn = serviceFan.getCharacteristic(Characteristic.On)
            .updateValue(this._getFanOn(dps[this.dpFanOn]))
            .on('get', this.getFanOn.bind(this))
            .on('set', this.setFanOn.bind(this));

        const characteristicRotationSpeed = serviceFan.getCharacteristic(Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: Math.max(100 / this.maxSpeed)
            })
            .updateValue(this.convertRotationSpeedFromTuyaToHomeKit(dps[this.dpRotationSpeed]))
            .on('get', this.getSpeed.bind(this))
            .on('set', this.setSpeed.bind(this));

        this.device.on('change', (changes, state) => {

            if (changes.hasOwnProperty(this.dpFanOn) && characteristicFanOn.value !== changes[this.dpFanOn])
                characteristicFanOn.updateValue(changes[this.dpFanOn]);

            if (changes.hasOwnProperty(this.dpRotationSpeed) && this.convertRotationSpeedFromHomeKitToTuya(characteristicRotationSpeed.value) !== changes[this.dpRotationSpeed])
                characteristicRotationSpeed.updateValue(this.convertRotationSpeedFromTuyaToHomeKit(changes[this.dpRotationSpeed]));

            this.log.debug('SimpleFan changed: ' + JSON.stringify(state));
        });
    }

    /*************************** FAN ***************************/
    // Get the Current Fan State
    getFanOn(callback) {
        this.getState(this.dpFanOn, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getFanOn(dp));
        });
    }

    _getFanOn(dp) {
        const {Characteristic} = this.hap;
        return dp;
    }

    setFanOn(value, callback) {
        const {Characteristic} = this.hap;
        // This uses the multistate set command to send the fan on and speed request in one call.
        if (value == false ) {
          this.fanCurrentSpeed = 0;
          // This will turn off the fan speed if it is set to be 0.
          return this.setState(this.dpFanOn, false, callback);
        } else {
          if (this.fanCurrentSpeed === 0) {
            // The current fanDefaultSpeed Variable is there to have the fan set to a sensible default if turned on.
            if (this.useStrings) {
                return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanDefaultSpeed.toString()}, callback);
            } else {
                return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanDefaultSpeed}, callback);
            }
          } else {
            // The current fanCurrentSpeed Variable is there to ensure the fan speed doesn't change if the fan is already on.
            if (this.useStrings) {
                return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanCurrentSpeed.toString()}, callback);
            } else {
                return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanCurrentSpeed}, callback);
            }
          }
        }
        callback();
    }

    // Get the Current Fan Speed
    getSpeed(callback) {
        this.getState(this.dpRotationSpeed, (err, dp) => {
            if (err) return callback(err);
            callback(null, this.convertRotationSpeedFromTuyaToHomeKit(this.device.state[this.dpRotationSpeed]));
        });
    }

    // Set the new fan speed
    setSpeed(value, callback) {
      const {Characteristic} = this.hap;
      if (value === 0) {
        // This is to set the fan speed variable to be 1 when the fan is off.
        if (this.useStrings) {
            return this.setMultiStateLegacy({[this.dpFanOn]: false, [this.dpRotationSpeed]: this.fanDefaultSpeed.toString()}, callback);
        } else {
            return this.setMultiStateLegacy({[this.dpFanOn]: false, [this.dpRotationSpeed]: this.fanDefaultSpeed}, callback);
        }
      } else {
        // This is to set the fan speed variable to match the current speed.
        this.fanCurrentSpeed = this.convertRotationSpeedFromHomeKitToTuya(value);
        // This uses the multistatelegacy set command to send the fan on and speed request in one call.
        if (this.useStrings) {
            return this.setMultiStateLegacy({[this.dpFanOn]: true, [this.dpRotationSpeed]: this.convertRotationSpeedFromHomeKitToTuya(value).toString()}, callback);
        } else {
            return this.setMultiStateLegacy({[this.dpFanOn]: true, [this.dpRotationSpeed]: this.convertRotationSpeedFromHomeKitToTuya(value)}, callback);            
        }
      }
      callback();
    }
}

module.exports = SimpleFanAccessory;
