const BaseAccessory = require('./BaseAccessory');

class SimpleFanAccessory extends BaseAccessory {
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
        this.dpUseLight = this._getCustomDP(this.device.context.dpUseLight) || true;

        const characteristicActive = serviceFan.getCharacteristic(Characteristic.On)
            .updateValue(this._getActive(dps[this.dpActive]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        const characteristicRotationSpeed = serviceFan.getCharacteristic(Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 3,
                minStep: 1
            })
            .updateValue(this._getSpeed(dps[this.dpRotationSpeed]))
            .on('get', this.getSpeed.bind(this))
            .on('set', this.setSpeed.bind(this));
            
        if (this.dpUseLight === true) {
        	const characterLightOn = serviceLightbulb.getCharacteristic(Characteristic.On)
	        	.updateValue(this._getLightOn(dps[this.dpLightOn]))
	        	.on('get', this.getLightOn.bind(this))
	        	.on('set', this.setLightOn.bind(this));
        	
	        const characteristicBrightness = serviceLightbulb.getCharacteristic(Characteristic.Brightness)
	            .setProps({
	                minValue: 0,
	                maxValue: 100,
	                minStep: 1
	            })
	            .updateValue(this.convertBrightnessFromTuyaToHomeKit(dps[this.dpBrightness]))
	            .on('get', this.getBrightness.bind(this))
	            .on('set', this.setBrightness.bind(this));
	        }
    }
    
/*************************** FAN ***************************/
// Fan State
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

// Fan Speed
    getSpeed(callback) {
        this.getState(this.dpRotationSpeed, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getSpeed(dp));
        });
    }

    _getSpeed(dp) {
        const {Characteristic} = this.hap;
//		console.log("_getSpeed = " + dp);
        return dp;
    }

    setSpeed(value, callback) {
        const {Characteristic} = this.hap;
        if (value == 0) {
        	return this.setState(this.dpActive, false, callback);
        } else {
        	return this.setState(this.dpRotationSpeed, value.toString(), callback);
        }

        callback();
    }
    
/*************************** LIGHT ***************************/
// Lightbulb State
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
    
// Lightbulb Brightness
    getBrightness(callback) {
        this.getState(this.dpBrightness, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getBrightness(dp));
        });
    }
    
    _getBrightness(dp) {
        const {Characteristic} = this.hap;
//		console.log("_getBrightness = " + dp);
        return dp;
    }

    setBrightness(value, callback) {
        const {Characteristic} = this.hap;
//        console.log("setBrightness - Raw value = " + value);
        return this.setState(this.dpBrightness, value, callback);

        callback();
    }
}

module.exports = SimpleFanAccessory;