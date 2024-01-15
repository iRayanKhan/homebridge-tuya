const BaseAccessory = require('./BaseAccessory');

class SimpleHeaterAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.AIR_HEATER;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;
        this.accessory.addService(Service.HeaterCooler, this.device.context.name);
        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const service = this.accessory.getService(Service.HeaterCooler);
        this._checkServiceName(service, this.device.context.name);

        this.dpActive = this._getCustomDP(this.device.context.dpActive) || '1';
        this.dpDesiredTemperature = this._getCustomDP(this.device.context.dpDesiredTemperature) || '2';
        this.dpCurrentTemperature = this._getCustomDP(this.device.context.dpCurrentTemperature) || '3';
        this.temperatureDivisor = parseInt(this.device.context.temperatureDivisor) || 1;
        this.dpCurrentHeaterCoolerState = this._getCustomDP(this.device.context.dpCurrentHeaterCoolerState) || '14';
        this.dpChildLock = this._getCustomDP(this.device.context.dpChildLock) || '7';
        this.debug = this.device.context.debug == true;

        const characteristicActive = service.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps[this.dpActive]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        const characteristicCurrentHeaterCoolerState = service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this._getCurrentHeaterCoolerState(dps[this.dpCurrentHeaterCoolerState]))
            .on('get', this.getCurrentHeaterCoolerState.bind(this));

        const characteristicTargetHeaterCoolerState = service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                minValue: 1,
                maxValue: 1,
                validValues: [Characteristic.TargetHeaterCoolerState.HEAT]
            })
            .updateValue(this._getTargetHeaterCoolerState())
            .on('get', this.getTargetHeaterCoolerState.bind(this))
            .on('set', this.setTargetHeaterCoolerState.bind(this));

        const characteristicCurrentTemperature = service.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: 0,
                maxValue: 30,
                minStep: 0.1
            })
            .updateValue(this._getDividedState(dps[this.dpCurrentTemperature], this.temperatureDivisor))
            .on('get', this.getDividedState.bind(this, this.dpCurrentTemperature, this.temperatureDivisor));


        const characteristicHeatingThresholdTemperature = service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: this.device.context.minTemperature || 15,
                maxValue: this.device.context.maxTemperature || 35,
                minStep: this.device.context.minTemperatureSteps || 0.5
            })
            .updateValue(this._getDividedState(dps[this.dpDesiredTemperature], this.temperatureDivisor))
            .on('get', this.getDividedState.bind(this, this.dpDesiredTemperature, this.temperatureDivisor))
            .on('set', this.setTargetThresholdTemperature.bind(this));

        this.characteristicHeatingThresholdTemperature = characteristicHeatingThresholdTemperature;

        let characteristicLockPhysicalControls;
        characteristicLockPhysicalControls = service.getCharacteristic(Characteristic.LockPhysicalControls)
            .updateValue(this._getLockPhysicalControls(dps[this.dpChildLock]))
            .on('get', this.getLockPhysicalControls.bind(this))
            .on('set', this.setLockPhysicalControls.bind(this));

        this.device.on('change', (changes, state) => {
            
            if (characteristicLockPhysicalControls && changes.hasOwnProperty(this.dpChildLock)) {
                const newLockPhysicalControls = this._getLockPhysicalControls(state[this.dpChildLock]);
                if (characteristicLockPhysicalControls.value !== newLockPhysicalControls) {
                    characteristicLockPhysicalControls.updateValue(newLockPhysicalControls);
                    if (this.debug) {
                        console.log("Tuya SimpleHeaterAccessory -->> LockPhysicalControls = " + newLockPhysicalControls);
                    }
                }
            }

            if (changes.hasOwnProperty(this.dpActive)) {
                const newActive = this._getActive(state[this.dpActive]);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);
                    if (this.debug) {
                        console.log("Tuya SimpleHeaterAccessory -->> Active = " + newActive);
                    }
                }
            }

            if (changes.hasOwnProperty(this.dpDesiredTemperature)) {
                const newHeatingThresholdTemperature = this._getDividedState(state[this.dpDesiredTemperature], this.temperatureDivisor);
                if (characteristicHeatingThresholdTemperature.value !== newHeatingThresholdTemperature) {
                    characteristicHeatingThresholdTemperature.updateValue(newHeatingThresholdTemperature);
                    if (this.debug) {
                        console.log("Tuya SimpleHeaterAccessory -->> HeatingThresholdTemperature = " + newHeatingThresholdTemperature);
                    }
                }
            }

            if (changes.hasOwnProperty(this.dpCurrentTemperature)) {
                const newCurrentTemperature = this._getDividedState(state[this.dpCurrentTemperature], this.temperatureDivisor);
                if (characteristicCurrentTemperature.value !== newCurrentTemperature)
                    characteristicCurrentTemperature.updateValue(newCurrentTemperature);
                    if (this.debug) { 
                        console.log("Tuya SimpleHeaterAccessory -->> characteristicCurrentTemperature = " + newCurrentHeaterCoolerState);
                    }
           }

           if (changes.hasOwnProperty(this.dpCurrentHeaterCoolerState)) {
		        const newCurrentHeaterCoolerState = this._getCurrentHeaterCoolerState(state[this.dpCurrentHeaterCoolerState]);
                if (characteristicCurrentHeaterCoolerState.value !== newCurrentHeaterCoolerState) {
                    characteristicCurrentHeaterCoolerState.updateValue(newCurrentHeaterCoolerState);
                    if (this.debug) { 
                        console.log("Tuya SimpleHeaterAccessory -->> CurrentHeaterCoolerState = " + newCurrentHeaterCoolerState);
                    }
                }
           }
            
            if (this.debug) { 
                console.log('Tuya SimpleHeaterAccessory -->> Device state: ' + JSON.stringify(state) + ' changes ' + JSON.stringify(changes)); 
            }
        });
    }

    getActive(callback) {
        this.getState(this.dpActive, (err, dpValue) => {
            if (err) return callback(err);
            callback(null, this._getActive(dpValue));
        });
    }

    _getActive(dpValue) {
        const {Characteristic} = this.hap;
        return dpValue ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
    }

    getLockPhysicalControls(callback) {
        this.getState(this.dpChildLock, (err, dpValue) => {
            if (err) return callback(err);
            callback(null, this._getLockPhysicalControls(dpValue));
        });
    }

    _getLockPhysicalControls(dpValue) {
        const {Characteristic} = this.hap;
        return dpValue ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }

    setLockPhysicalControls(value, callback) {
        const {Characteristic} = this.hap;
        switch (value) {
            case Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED:
                return this.setState(this.dpChildLock, true, callback);
            default:
                return this.setState(this.dpChildLock, false, callback);
        }
    }

    setActive(value, callback) {
        const {Characteristic} = this.hap;
        switch (value) {
            case Characteristic.Active.ACTIVE:
                return this.setState(this.dpActive, true, callback);
            default:
                return this.setState(this.dpActive, false, callback);
        }
    }

    getCurrentHeaterCoolerState(callback) {
        this.getState(this.dpCurrentHeaterCoolerState, (err, dpValue) => {
            if (err) return callback(err);
            callback(null, this._getCurrentHeaterCoolerState(dpValue));
        });
    }

    _getCurrentHeaterCoolerState(dpValue) {
        const { Characteristic } = this.hap;
        switch (dpValue) {
            case "heating":
                return Characteristic.CurrentHeaterCoolerState.HEATING;
            default:
                return Characteristic.CurrentHeaterCoolerState.IDLE;
        }
    }

    getTargetHeaterCoolerState(callback) {
        callback(null, this._getTargetHeaterCoolerState());
    }

    _getTargetHeaterCoolerState() {
        const {Characteristic} = this.hap;
        return Characteristic.TargetHeaterCoolerState.HEAT;
    }

    setTargetHeaterCoolerState(value, callback) {
        this.setState(this.dpActive, true, callback);
    }

    setTargetThresholdTemperature(value, callback) {
        this.setState(this.dpDesiredTemperature, value * this.temperatureDivisor, err => {
            if (err) return callback(err);
            if (this.characteristicHeatingThresholdTemperature) {
                this.characteristicHeatingThresholdTemperature.updateValue(value);
            }

            callback();
        });
    }
}

module.exports = SimpleHeaterAccessory;
