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
        const service = this.accessory.getService(Service.Fan);
        this._checkServiceName(service, this.device.context.name);

        this.dpActive = this._getCustomDP(this.device.context.dpActive) || '1';
        this.dpRotationSpeed = this._getCustomDP(this.device.context.dpRotationSpeed) || '3';

        const characteristicActive = service.getCharacteristic(Characteristic.On)
            .updateValue(this._getActive(dps[this.dpActive]))
            .on('get', this.getActive.bind(this));

        const characteristicRotationSpeed = service.getCharacteristic(Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 3,
                minStep: 1
            })
            .updateValue(this._getSpeed(dps[this.dpRotationSpeed]))
            .on('get', this.getSpeed.bind(this))
            .on('set', this.setSpeed.bind(this));
    }

    // Get the Current Fan State
    getActive(callback) {
        this.getState(this.dpActive, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getActive(dp));
        });
    }

    _getActive(dp) {
        const {Characteristic} = this.hap;

        return dp;
    }

    setActive(value, callback) {
        const {Characteristic} = this.hap;
        return this.setState(this.dpActive, value, callback);

        callback();
    }

    // Get the Current Fan Speed
    getSpeed(callback) {
        this.getState(this.dpRotationSpeed, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getSpeed(dp));
        });
    }

    _getSpeed(dp) {
        const {Characteristic} = this.hap;
        return dp;
    }

    // Set the new fan speed
    setSpeed(value, callback) {
      const {Characteristic} = this.hap;
      if (value === 0) {
        // This will turn off the fan speed if it is set to be 0.
        return this.setState(this.dpActive, false, callback);
      } else {
        // This uses the multistate set command to send the fan on and speed request in one call.
        return this.setMultiState({[this.dpActive]: true, [this.dpRotationSpeed]: value.toString()}, callback);
      }
      callback();
    }

}

module.exports = SimpleFanAccessory;
