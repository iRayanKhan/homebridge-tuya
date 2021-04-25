const BaseAccessory = require('./BaseAccessory');
const async = require('async');

class OilDiffuserAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.DEHUMIDIFIER;
    }

    constructor(...props) {
        super(...props);
    }

    _isBelleLife() {
        if (this.device.context.manufacturer.trim().toLowerCase() === 'bellelife') {
            return true;
        } else {
            return false;
        }
    }
    
    _isGeeni() {
        if (this.device.context.manufacturer.trim().toLowerCase() === 'geeni') {
            return true;
        } else {
            return false;
        }
    }

    _isAsakuki() {
        if (this.device.context.manufacturer.trim().toLowerCase() === 'asakuki') {
            return true;
        } else {
            return false;
        }
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

        const {Service, AdaptiveLightingController, Characteristic, EnergyCharacteristics} = this.hap;

        const humidifierService = this.accessory.getServiceByUUIDAndSubType(Service.HumidifierDehumidifier, 'humidifier');
        const lightService = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, 'lightbulb');

        this.dpLight = this._getCustomDP(this.device.context.dpLight) || '5';
        this.dpMode = this._getCustomDP(this.device.context.dpMode) || '6';
        this.dpColor = this._getCustomDP(this.device.context.dpColor) || '8';
        this.dpActive = this._getCustomDP(this.device.context.dpActive) || '1';
        this.dpRotationSpeed = this._getCustomDP(this.device.context.dpRotationSpeed) || '2';
        this.dpWaterLevel = this._getCustomDP(this.device.context.dpWaterLevel) || '9';
        this.maxSpeed = this._getCustomDP(this.device.context.maxSpeed) || 2;

        if(this._isBelleLife()){
            this.cmdInterval = 'interval';
            this.cmdLow = 'small';
            this.cmdHigh = 'large';
        }
        else if(this._isGeeni()){
            this.cmdInterval = '2';
            this.cmdContinuous = '1';
        } 
        else if(this._isAsakuki()){
            this.cmdLow = 'small';
            this.cmdHigh = 'big';
        } 
        else {
            this.cmdInterval = this.device.context.cmdInterval || '2';
            this.cmdContinuous = this.device.context.cmdContinuous || '1';
        }

        this._detectColorFunction(dps[this.dpColor]);
	
	    this.cmdWhite = 'white';
        if (this.device.context.cmdWhite) {
            if (/^w[a-z]+$/i.test(this.device.context.cmdWhite)) this.cmdWhite = ('' + this.device.context.cmdWhite).trim();
            else throw new Error(`The cmdWhite doesn't appear to be valid: ${this.device.context.cmdWhite}`);
        }

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
	
	    const characteristicBrightness = lightService.getCharacteristic(Characteristic.Brightness)
            .updateValue(dps[this.dpMode] === this.cmdWhite ? this.convertBrightnessFromTuyaToHomeKit(dps[this.dpColor]).b : this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).b)
            .on('get', this.getBrightness.bind(this))
            .on('set', this.setBrightness.bind(this));

	    const characteristicColorTemperature = lightService.getCharacteristic(Characteristic.ColorTemperature)
            .setProps({
                minValue: 0,
                maxValue: 600
            })
            .updateValue(dps[this.dpMode] === this.cmdWhite ? this.convertColorTemperatureFromTuyaToHomeKit(dps[this.dpColorTemperature]) : 0)
            .on('get', this.getColorTemperature.bind(this))
            .on('set', this.setColorTemperature.bind(this));

        const characteristicHue = lightService.getCharacteristic(Characteristic.Hue)
            .updateValue(this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).h)
            .on('get', this.getHue.bind(this))
            .on('set', this.setHue.bind(this));

        const characteristicSaturation = lightService.getCharacteristic(Characteristic.Saturation)
	    .updateValue(this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).s)            
            .on('get', this.getSaturation.bind(this))
            .on('set', this.setSaturation.bind(this)); 


        this.characteristicHue = characteristicHue;
        this.characteristicSaturation = characteristicSaturation;
	    this.characteristicColorTemperature = characteristicColorTemperature;
	    this.characteristicBrightness = characteristicBrightness;

	    if (this.adaptiveLightingSupport()) {
            this.adaptiveLightingController = new AdaptiveLightingController(lightService);
            this.accessory.configureController(this.adaptiveLightingController);
            this.accessory.adaptiveLightingController = this.adaptiveLightingController;
        }

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

	    const characteristicWaterLevel = humidifierService.getCharacteristic(Characteristic.WaterLevel)
            .updateValue(this._getWaterLevel(dps[this.dpWaterLevel]))
            .on('get', this.getWaterLevel.bind(this))
            
        humidifierService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .updateValue(this.dpActive ? 1 : 0)
            .on('get', this.getRotationSpeed.bind(this));
 
        const characteristicRotationSpeed = humidifierService.getCharacteristic(Characteristic.RotationSpeed)
        .setProps({
            minValue: 0,
            maxValue: this.maxSpeed,
            minStep: 1
        })
            .updateValue(this._getRotationSpeed(dps))
            .on('get', this.getRotationSpeed.bind(this))
            .on('set', this.setRotationSpeed.bind(this));

        this.characteristicActive = characteristicActive;
        this.characteristicRotationSpeed = characteristicRotationSpeed;

        
            
        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpLight) && characteristicLightOn.value !== changes[this.dpLight]) characteristicLightOn.updateValue(changes[this.dpLight]);

            if (changes.hasOwnProperty(this.dpActive)) {
                const newActive = this._getActive(changes[this.dpActive]);
                if (characteristicActive.value !== newActive) characteristicActive.updateValue(newActive);
            }

            if (changes.hasOwnProperty(this.dpRotationSpeed)) {
                const newValue = this._getRotationSpeed(changes[this.dpRotationSpeed]);
                if (characteristicRotationSpeed.value !== newValue) characteristicRotationSpeed.updateValue(newValue);
            }

            if (changes.hasOwnProperty(this.dpWaterLevel) && characteristicWaterLevel) {
                const waterLevel = changes[this.dpWaterLevel]
                if (characteristicWaterLevel.value !== waterLevel) characteristicWaterLevel.updateValue(waterLevel);
            }
            
            if (changes.hasOwnProperty(this.dpColor)) {
                const oldColor = this.convertColorFromTuyaToHomeKit(this.convertColorFromHomeKitToTuya({
                    h: characteristicHue.value,
                    s: characteristicSaturation.value,
                    b: characteristicBrightness.value
                }));
                const newColor = this.convertColorFromTuyaToHomeKit(changes[this.dpColor]);

                if (oldColor.h !== newColor.h) characteristicHue.updateValue(newColor.h);

                if (oldColor.s !== newColor.s) characteristicSaturation.updateValue(newColor.s);
		
                if (oldColor.b !== newColor.b) characteristicBrightness.updateValue(newColor.b);
            }

        });
    }
    
    getBrightness(callback) {
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, this.convertBrightnessFromTuyaToHomeKit(this.device.state[this.dpColor]).b);
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).b);
    }

    setBrightness(value, callback) {
        if(value === 0) {  
            return this.setState(this.dpLight, false, callback); 
        }
        else {
            if (this.device.state[this.dpMode] === this.cmdWhite) return this.setState((this.dpColor).b, this.convertBrightnessFromHomeKitToTuya({b: value}), callback);
            this.device.state[this.dpMode] = this.cmdColor;
            this.setMultiState({[this.dpMode]: this.cmdColor, [this.dpColor]: this.convertColorFromHomeKitToTuya({b: value})}, callback);
        }
    }

    getColorTemperature(callback) {
        if (this.device.state[this.dpMode] !== this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorTemperatureFromTuyaToHomeKit(this.device.state[this.dpColorTemperature]));
    }
    
    setColorTemperature(value, callback) {
        if (value === 0) return callback(null, true);
	
        const newColor = this.convertHomeKitColorTemperatureToHomeKitColor(value);
	    const oldColor = this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]);

        this.characteristicHue.updateValue(newColor.h);
        this.characteristicSaturation.updateValue(newColor.s);
        this.device.state[this.dpMode] = this.cmdColor;
	
	    this.setMultiState({[this.dpMode]: this.cmdColor, [this.dpColor]: this.convertColorFromHomeKitToTuya(newColor)}, callback);
    }

    getHue(callback) {
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).h);
    }

    setHue(value, callback) {
        this._setHueSaturation({h: value}, callback);
    }

    getSaturation(callback) {
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).s);
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
        if (this.characteristicActive.value !== value){
            const {Characteristic} = this.hap;
            switch (value) {
                case Characteristic.Active.ACTIVE:
                    return this.setState(this.dpActive, true, callback);

                case Characteristic.Active.INACTIVE:
                    return this.setState(this.dpActive, false, callback);
            }
            callback();
        }
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
        this.getState([this.dpActive], (err, dps) => {
            if (err) return callback(err);
            callback(null, this._getTargetHumidifierDehumidifierState(dps));
        });
        //callback(null, this._getTargetHumidifierDehumidifierState());
    }

    _getTargetHumidifierDehumidifierState() {
        const {Characteristic} = this.hap;
        return Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER;
    }
    
    setTargetHumidifierDehumidifierState(value, callback) {
        this.setState(this.dpActive, true, callback);
    }

    getWaterLevel(callback) {
        this.getState(this.dpWaterLevel, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getWaterLevel(dp));
        });
    }
    
    // Will hardcode water levels until its needed -Ed, mine only shows empty or not.
    _getWaterLevel(value) {
	if(parseFloat(value) == 0) {return 69;}
	else {return 0;}
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
            const currentRotationSpeed = this.convertRotationSpeedFromHomeKitToTuya(this._hkRotationSpeed);

            return currentRotationSpeed === dps[this.dpRotationSpeed] ? this._hkRotationSpeed : this.convertRotationSpeedFromTuyaToHomeKit(dps[this.dpRotationSpeed]);
        }

        return this._hkRotationSpeed = this.convertRotationSpeedFromTuyaToHomeKit(dps[this.dpRotationSpeed]);
    }

    setRotationSpeed(value, callback) {
        const {Characteristic} = this.hap;

        if (value === 0) {
            this.setState(this.dpActive, false, callback);
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
        if (this._isBelleLife()) {
            return {[this.cmdInterval]: 1, [this.cmdLow]: 2, [this.cmdHigh]: 3}[value];
        }
        else if (this._isGeeni()){
            return {[this.cmdInterval]: 1, [this.cmdContinuous]: 2}[value];
        }
        else if (this._isAsakuki()){
            return {[this.cmdLow]: 1, [this.cmdHigh]: 2}[value];
        }
        else{
            return {[this.cmdInterval]: 1, [this.cmdContinuous]: 2}[value];
        }
    }

    convertRotationSpeedFromHomeKitToTuya(value) {
            if (this._isBelleLife()) {
                if (value < 2)
                    return this.cmdLow;
                else if (value < 3)
                    return this.cmdMiddle
                else
                    return this.cmdHigh;
            }
            else if (this._isGeeni()) {
                if (value < 2)
                    return this.cmdInterval;
                else
                    return this.cmdContinuous;
            }
            else if (this._isAsakuki()) {
                if (value < 2)
                    return this.cmdLow;
                else
                    return this.cmdHigh;
            }
            else {
                if (value < 2)
                    return this.cmdLow;
                else
                    return this.cmdHigh;
            }
    }
}

module.exports = OilDiffuserAccessory;
