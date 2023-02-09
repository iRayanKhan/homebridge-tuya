const BaseAccessory = require('./BaseAccessory');

class SimpleFanLightAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.FANLIGHT;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;
        this.accessory.addService(Service.Fan, this.device.context.name);
        this.accessory.addService(Service.Lightbulb, this.device.context.name + " Light");
        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const serviceFan = this.accessory.getService(Service.Fan);
        const serviceLightbulb = this.accessory.getService(Service.Lightbulb);
        this._checkServiceName(serviceFan, this.device.context.name);
        this._checkServiceName(serviceLightbulb, this.device.context.name + " Light");

        this.dpActive = this._getCustomDP(this.device.context.dpActive) || '1';
        this.dpRotationSpeed = this._getCustomDP(this.device.context.RotationSpeed) || '3';
        this.dpLightOn = this._getCustomDP(this.device.context.dpLightOn) || '9';
        this.dpBrightness = this._getCustomDP(this.device.context.dpBrightness) || '10';
        this.useLight = this._coerceBoolean(this.device.context.useLight, true);
        this.useBrightness = this._coerceBoolean(this.device.context.useBrightness, true);
        this.maxSpeed = parseInt(this.device.context.maxSpeed) || 3;

        const characteristicActive = serviceFan.getCharacteristic(Characteristic.On)
            .updateValue(this._getActive(dps[this.dpActive]))
            .on('get', this.getActive.bind(this))

        const characteristicRotationSpeed = serviceFan.getCharacteristic(Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: this.maxSpeed,
                minStep: 1
            })
            .updateValue(this._getSpeed(dps[this.dpRotationSpeed]))
            .on('get', this.getSpeed.bind(this))
            .on('set', this.setSpeed.bind(this));

        let characterLightOn;
        let characteristicBrightness;
        if (this.useLight) {
            characterLightOn = serviceLightbulb.getCharacteristic(Characteristic.On)
                .updateValue(this._getLightOn(dps[this.dpLightOn]))
                .on('get', this.getLightOn.bind(this))
                .on('set', this.setLightOn.bind(this));

            if (this.useBrightness) {
                characteristicBrightness = serviceLightbulb.getCharacteristic(Characteristic.Brightness)
                    .setProps({
                        minValue: 0,
                        maxValue: 1000,
                        minStep: 100
                    })
                    .updateValue(this.convertBrightnessFromTuyaToHomeKit(dps[this.dpBrightness]))
                    .on('get', this.getBrightness.bind(this))
                    .on('set', this.setBrightness.bind(this));
            }
        }

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpRotationSpeed) && characteristicRotationSpeed.value !== changes[this.dpRotationSpeed])
                characteristicRotationSpeed.updateValue(changes[this.dpRotationSpeed]);

            if (changes.hasOwnProperty(this.dpLightOn) && characterLightOn && characterLightOn.value !== changes[this.dpLightOn])
                characterLightOn.updateValue(changes[this.dpLightOn]);

            if (changes.hasOwnProperty(this.dpBrightness) && characteristicBrightness && characteristicBrightness.value !== changes[this.dpBrightness])
                characteristicBrightness.updateValue(changes[this.dpBrightness]);

            console.log('[Tuya] SimpleFanLight changed: ' + JSON.stringify(state));
        });
    }

    /*************************** FAN ***************************/
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

    /*************************** LIGHT ***************************/
    //Lightbulb State
    getLightOn(callback) {
        this.getState(this.dpLightOn, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getLightOn(dp));
        });
    }

    _getLightOn(dp) {
        const {Characteristic} = this.hap;
        return dp;
    }

    setLightOn(value, callback) {
        const {Characteristic} = this.hap;
        return this.setState(this.dpLightOn, value, callback);
        callback();
    }

    //Lightbulb Brightness
    getBrightness(callback) {
        this.getState(this.dpBrightness, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getBrightness(dp));
        });
    }

    _getBrightness(dp) {
        const {Characteristic} = this.hap;
        return dp;
    }

    setBrightness(value, callback) {
        const {Characteristic} = this.hap;
        return this.setState(this.dpBrightness, value, callback);
        callback();
    }
}

module.exports = SimpleFanLightAccessory;
