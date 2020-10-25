const BaseAccessory = require('./BaseAccessory');
const async = require('async');

class OilDiffuserAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.OUTLET;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        this._verifyCachedPlatformAccessory();
        this._justRegistered = true;

        super._registerPlatformAccessory();
    }

    _verifyCachedPlatformAccessory() {
        if (this._justRegistered) return;

        const {Service} = this.hap;

        const humidifierName = this.device.context.name;
        let humidifierService = this.accessory.getServiceByUUIDAndSubType(Service.HumidifierDehumidifier, 'humidifier');
        if (humidifierService) this._checkServiceName(humidifierService, humidifierName);
        else humidifierService = this.accessory.addService(Service.HumidifierDehumidifier, humidifierName, 'humidifier');

        const lightName = this.device.context.name + ' Light';
        let lightService = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, 'lightbulb');
        if (lightService) this._checkServiceName(lightService, lightName);
        else lightService = this.accessory.addService(Service.Lightbulb, lightName, 'lightbulb');

        this.accessory.services
            .forEach(service => {
                if ((service.UUID === Service.HumidifierDehumidifier.UUID && service !== humidifierService) || (service.UUID === Service.Lightbulb.UUID && service !== lightService))
                    this.accessory.removeService(service);
            });
    }

    _registerCharacteristics(dps) {
        this._verifyCachedPlatformAccessory();

        const {Service, Characteristic, EnergyCharacteristics} = this.hap;

        const humidifierService = this.accessory.getServiceByUUIDAndSubType(Service.HumidifierDehumidifier, 'humidifier');
        const lightService = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, 'lightbulb');

        this.dpLight = this._getCustomDP(this.device.context.dpLight) || '5';
        this.dpMode = this._getCustomDP(this.device.context.dpMode) || '6';
        this.dpColor = this._getCustomDP(this.device.context.dpColor) || '8';

        this.dpActive = this._getCustomDP(this.device.context.dpActive) || '1';
        this.dpRotationSpeed = this._getCustomDP(this.device.context.dpRotationSpeed) || '2';
        this.dpWaterLevel = this._getCustomDP(this.device.context.dpWaterLevel) || '9';

        
        this.cmdLow = 'interval';
        if (this.device.context.cmdLow) {
            if (/^l[a-z]+$/i.test(this.device.context.cmdLow)) this.cmdLow = ('' + this.device.context.cmdLow).trim();
            else throw new Error('The cmdLow doesn\'t appear to be valid: ' + this.device.context.cmdLow);
        }

        this.cmdMiddle = 'small';
        if (this.device.context.cmdMiddle) {
            if (/^l[a-z]+$/i.test(this.device.context.cmdMiddle)) this.cmdMiddle = ('' + this.device.context.cmdMiddle).trim();
            else throw new Error('The cmdMiddle doesn\'t appear to be valid: ' + this.device.context.cmdMiddle);
        }

        this.cmdHigh = 'large';
        if (this.device.context.cmdHigh) {
            if (/^h[a-z]+$/i.test(this.device.context.cmdHigh)) this.cmdHigh = ('' + this.device.context.cmdHigh).trim();
            else throw new Error('The cmdHigh doesn\'t appear to be valid: ' + this.device.context.cmdHigh);
        }

        this._detectColorFunction(dps[this.dpColor]);

        this.cmdColor = 'colour';
        if (this.device.context.cmdColor) {
            if (/^c[a-z]+$/i.test(this.device.context.cmdColor)) this.cmdColor = ('' + this.device.context.cmdColor).trim();
            else throw new Error(`The cmdColor doesn't appear to be valid: ${this.device.context.cmdColor}`);
        } else if (this.device.context.cmdColour) {
            if (/^c[a-z]+$/i.test(this.device.context.cmdColour)) this.cmdColor = ('' + this.device.context.cmdColour).trim();
            else throw new Error(`The cmdColour doesn't appear to be valid: ${this.device.context.cmdColour}`);
        }


        // Led Light

        const characteristicLightOn = lightService.getCharacteristic(Characteristic.On)
            .updateValue(dps[this.dpLight])
            .on('get', this.getState.bind(this, this.dpLight))
            .on('set', this.setState.bind(this, this.dpLight));

        const characteristicHue = lightService.getCharacteristic(Characteristic.Hue)
            .updateValue(this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).h)
            .on('get', this.getHue.bind(this))
            .on('set', this.setHue.bind(this));

        const characteristicSaturation = lightService.getCharacteristic(Characteristic.Saturation)
            .setProps({
                minValue: 100,
                maxValue: 100
            })
            .updateValue(100)
            .on('get', this.getSaturation.bind(this))
            .on('set', this.setSaturation.bind(this));


        this.characteristicHue = characteristicHue;
        this.characteristicSaturation = characteristicSaturation;


        // Humidifier
        
        const characteristicActive = humidifierService.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps[this.dpActive]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

            
        humidifierService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
            .updateValue(this._getCurrentHumidifierDehumidifierState(dps))
            .on('get', this.getCurrentHumidifierDehumidifierState.bind(this));

        humidifierService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
            .setProps({
                minValue: 1,
                maxValue: 1,
                validValues: [1]
            })
            .updateValue(this._getTargetHumidifierDehumidifierState())
            .on('get', this.getTargetHumidifierDehumidifierState.bind(this))
            .on('set', this.setTargetHumidifierDehumidifierState.bind(this));

        // const characteristicWaterLevel = humidifierService.getCharacteristic(Characteristic.WaterLevel)
        //     .updateValue(this._getWaterLevel(dps[this.dpWaterLevel]))
        //     .on('get', this.getWaterLevel.bind(this))

            
        humidifierService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .updateValue(0)
            .on('get', this.getHumidity.bind(this))

            
        const characteristicRotationSpeed = humidifierService.getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(this._getRotationSpeed(dps))
            .on('get', this.getRotationSpeed.bind(this))
            .on('set', this.setRotationSpeed.bind(this));

        this.characteristicActive = characteristicActive;
        this.characteristicRotationSpeed = characteristicRotationSpeed;



        
        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpLight) && characteristicLightOn.value !== changes[this.dpLight]) characteristicLightOn.updateValue(changes[this.dpLight]);

            if (changes.hasOwnProperty(this.dpActive)) {
                const newActive = this._getActive(changes[this.dpActive]);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);
                }
            }

            if (changes.hasOwnProperty(this.dpRotationSpeed)) {
                const newValue = this._getRotationSpeed(changes[this.dpRotationSpeed]);
                if (characteristicActive.value !== newValue) {
                    characteristicActive.updateValue(newValue);
                }
            }

            // if (changes.hasOwnProperty(this.dpWaterLevel) && characteristicWaterLevel) {
            //     const waterLevel = changes[this.dpWaterLevel]
            //     if (characteristicWaterLevel.value !== waterLevel) characteristicWaterLevel.updateValue(waterLevel);
            // }
            
            if (changes.hasOwnProperty(this.dpColor)) {
                const oldColor = this.convertColorFromTuyaToHomeKit(this.convertColorFromHomeKitToTuya({
                    h: characteristicHue.value,
                    s: characteristicSaturation.value,
                    b: 100
                }));
                const newColor = this.convertColorFromTuyaToHomeKit(changes[this.dpColor]);

                if (oldColor.h !== newColor.h) characteristicHue.updateValue(newColor.h);

                if (oldColor.s !== newColor.s) characteristicSaturation.updateValue(newColor.h);

            }

        });
    }

    getHue(callback) {
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).h);
    }

    setHue(value, callback) {
        this._setHueSaturation({h: value}, callback);
    }

    getSaturation(callback) {
        callback(null, 100);
    }

    setSaturation(value, callback) {
        this._setHueSaturation({s: value}, callback);
    }

    _setHueSaturation(prop, callback) {
        if (!this._pendingHueSaturation) {
            this._pendingHueSaturation = {props: {}, callbacks: []};
        }

        if (prop) {
            if (this._pendingHueSaturation.timer) clearTimeout(this._pendingHueSaturation.timer);

            this._pendingHueSaturation.props = {...this._pendingHueSaturation.props, ...prop};
            this._pendingHueSaturation.callbacks.push(callback);

            this._pendingHueSaturation.timer = setTimeout(() => {
                this._setHueSaturation();
            }, 500);
            return;
        }


        const callbacks = this._pendingHueSaturation.callbacks;
        const callEachBack = err => {
            async.eachSeries(callbacks, (callback, next) => {
                try {
                    callback(err);
                } catch (ex) {}
                next();
            });
        };

        const isSham = this._pendingHueSaturation.props.h === 0 && this._pendingHueSaturation.props.s === 0;
        const newValue = this.convertColorFromHomeKitToTuya(this._pendingHueSaturation.props);
        this._pendingHueSaturation = null;

        // Avoid cross-mode complications due rapid commands
        this.device.state[this.dpMode] = this.cmdColor;

        this.setMultiState({[this.dpMode]: this.cmdColor, [this.dpColor]: newValue}, callEachBack);
    }
    
    getActive(callback) {
        this.getState(this.dpActive, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getActive(dp));
        });
    }

    _getActive(dp) {
        const {Characteristic} = this.hap;

        return dp ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
    }

    setActive(value, callback) {
        const {Characteristic} = this.hap;

        switch (value) {
            case Characteristic.Active.ACTIVE:
                return this.setState(this.dpActive, true, callback);

            case Characteristic.Active.INACTIVE:
                return this.setState(this.dpActive, false, callback);
        }

        callback();
    }
    
    getCurrentHumidifierDehumidifierState(callback) {
        this.getState([this.dpActive], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getCurrentHumidifierDehumidifierState(dps));
        });
    }

    _getCurrentHumidifierDehumidifierState(dps) {
        const {Characteristic} = this.hap;
        return dps[this.dpActive] ? Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING : Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;
    }

    getTargetHumidifierDehumidifierState(callback) {
        callback(null, this._getTargetHumidifierDehumidifierState());
    }

    _getTargetHumidifierDehumidifierState() {
        const {Characteristic} = this.hap;
        return Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER;
    }
    
    setTargetHumidifierDehumidifierState(value, callback) {
        this.setState(this.dpActive, true, callback);
    }
    
    
    getHumidity(callback) {
        callback(null, 0);
    }

    getWaterLevel(callback) {
        this.getState(this.dpWaterLevel, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getWaterLevel(dp));
        });
    }

    _getWaterLevel(value) {
        return parseFloat(value) || 0;
    }

    getRotationSpeed(callback) {
        this.getState([this.dpActive, this.dpRotationSpeed], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getRotationSpeed(dps));
        });
    }

    _getRotationSpeed(dps) {
        if (!dps[this.dpActive]) return 0;

        if (this._hkRotationSpeed) {
            const currntRotationSpeed = this.convertRotationSpeedFromHomeKitToTuya(this._hkRotationSpeed);

            return currntRotationSpeed === dps[this.dpRotationSpeed] ? this._hkRotationSpeed : this.convertRotationSpeedFromTuyaToHomeKit(dps[this.dpRotationSpeed]);
        }

        return this._hkRotationSpeed = this.convertRotationSpeedFromTuyaToHomeKit(dps[this.dpRotationSpeed]);
    }

    setRotationSpeed(value, callback) {
        const {Characteristic} = this.hap;

        if (value === 0) {
            this.setActive(Characteristic.Active.INACTIVE, callback);
        } else {
            this._hkRotationSpeed = value;

            const newSpeed = this.convertRotationSpeedFromHomeKitToTuya(value);
            const currentSpeed = this.convertRotationSpeedFromHomeKitToTuya(this.characteristicRotationSpeed.value);

            if (this.enableFlipSpeedSlider) this._hkRotationSpeed = this.convertRotationSpeedFromTuyaToHomeKit(newSpeed);

            if (newSpeed !== currentSpeed) {
                this.characteristicRotationSpeed.updateValue(this._hkRotationSpeed);
                this.setMultiState({[this.dpActive]: true, [this.dpRotationSpeed]: newSpeed}, callback);
            } else {
                callback();
                if (this.enableFlipSpeedSlider)
                    process.nextTick(() => {
                        this.characteristicRotationSpeed.updateValue(this._hkRotationSpeed);
                    });
            }
        }
    }

    convertRotationSpeedFromTuyaToHomeKit(value) {
        return {[this.cmdLow]: 10, [this.cmdMiddle]: 40, [this.cmdHigh]: 100}[value];
    }

    convertRotationSpeedFromHomeKitToTuya(value) {
        if (value < 20)
            return this.cmdLow;
        else if (value < 60)
            return this.cmdMiddle
        else
            return this.cmdHigh;
    }
}

module.exports = OilDiffuserAccessory;