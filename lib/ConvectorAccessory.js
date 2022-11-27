const BaseAccessory = require('./BaseAccessory');

class ConvectorAccessory extends BaseAccessory {
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

        this.dpActive = this._getCustomDP(this.device.context.dpActive) || '7';
        this.dpDesiredTemperature = this._getCustomDP(this.device.context.dpDesiredTemperature) || '2';
        this.dpCurrentTemperature = this._getCustomDP(this.device.context.dpCurrentTemperature) || '3';
        this.dpRotationSpeed = this._getCustomDP(this.device.context.dpRotationSpeed) || '4';
        this.dpChildLock = this._getCustomDP(this.device.context.dpChildLock) || '6';
        this.dpTemperatureDisplayUnits = this._getCustomDP(this.device.context.dpTemperatureDisplayUnits) || '19';

        this.cmdLow = 'LOW';
        if (this.device.context.cmdLow) {
            if (/^[a-z0-9]+$/i.test(this.device.context.cmdLow)) this.cmdLow = ('' + this.device.context.cmdLow).trim();
            else throw new Error('The cmdLow doesn\'t appear to be valid: ' + this.device.context.cmdLow);
        }

        this.cmdHigh = 'HIGH';
        if (this.device.context.cmdHigh) {
            if (/^[a-z0-9]+$/i.test(this.device.context.cmdHigh)) this.cmdHigh = ('' + this.device.context.cmdHigh).trim();
            else throw new Error('The cmdHigh doesn\'t appear to be valid: ' + this.device.context.cmdHigh);
        }

        this.enableFlipSpeedSlider = !!this.device.context.enableFlipSpeedSlider;

        const characteristicActive = service.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps[this.dpActive]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this._getCurrentHeaterCoolerState(dps))
            .on('get', this.getCurrentHeaterCoolerState.bind(this));

        service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                minValue: 1,
                maxValue: 1,
                validValues: [Characteristic.TargetHeaterCoolerState.HEAT]
            })
            .updateValue(this._getTargetHeaterCoolerState())
            .on('get', this.getTargetHeaterCoolerState.bind(this))
            .on('set', this.setTargetHeaterCoolerState.bind(this));

        const characteristicCurrentTemperature = service.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(dps[this.dpCurrentTemperature])
            .on('get', this.getState.bind(this, this.dpCurrentTemperature));


        const characteristicHeatingThresholdTemperature = service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: this.device.context.minTemperature || 15,
                maxValue: this.device.context.maxTemperature || 35,
                minStep: this.device.context.minTemperatureSteps || 1
            })
            .updateValue(dps[this.dpDesiredTemperature])
            .on('get', this.getState.bind(this, this.dpDesiredTemperature))
            .on('set', this.setTargetThresholdTemperature.bind(this));


        let characteristicTemperatureDisplayUnits;
        if (!this.device.context.noTemperatureUnit) {
            characteristicTemperatureDisplayUnits = service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
                .updateValue(this._getTemperatureDisplayUnits(dps[this.dpTemperatureDisplayUnits]))
                .on('get', this.getTemperatureDisplayUnits.bind(this))
                .on('set', this.setTemperatureDisplayUnits.bind(this));
        } else this._removeCharacteristic(service, Characteristic.TemperatureDisplayUnits);

        let characteristicLockPhysicalControls;
        if (!this.device.context.noChildLock) {
            characteristicLockPhysicalControls = service.getCharacteristic(Characteristic.LockPhysicalControls)
                .updateValue(this._getLockPhysicalControls(dps[this.dpChildLock]))
                .on('get', this.getLockPhysicalControls.bind(this))
                .on('set', this.setLockPhysicalControls.bind(this));
        } else this._removeCharacteristic(service, Characteristic.LockPhysicalControls);

        const characteristicRotationSpeed = service.getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(this._getRotationSpeed(dps))
            .on('get', this.getRotationSpeed.bind(this))
            .on('set', this.setRotationSpeed.bind(this));

        this.characteristicActive = characteristicActive;
        this.characteristicHeatingThresholdTemperature = characteristicHeatingThresholdTemperature;
        this.characteristicRotationSpeed = characteristicRotationSpeed;

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpActive)) {
                const newActive = this._getActive(changes[this.dpActive]);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);

                    if (!changes.hasOwnProperty(this.dpRotationSpeed)) {
                        characteristicRotationSpeed.updateValue(this._getRotationSpeed(state));
                    }
                }
            }

            if (characteristicLockPhysicalControls && changes.hasOwnProperty(this.dpChildLock)) {
                const newLockPhysicalControls = this._getLockPhysicalControls(changes[this.dpChildLock]);
                if (characteristicLockPhysicalControls.value !== newLockPhysicalControls) {
                    characteristicLockPhysicalControls.updateValue(newLockPhysicalControls);
                }
            }

            if (changes.hasOwnProperty(this.dpDesiredTemperature)) {
                if (characteristicHeatingThresholdTemperature.value !== changes[this.dpDesiredTemperature])
                    characteristicHeatingThresholdTemperature.updateValue(changes[this.dpDesiredTemperature]);
            }

            if (changes.hasOwnProperty(this.dpCurrentTemperature) && characteristicCurrentTemperature.value !== changes[this.dpCurrentTemperature]) characteristicCurrentTemperature.updateValue(changes[this.dpCurrentTemperature]);

            if (characteristicTemperatureDisplayUnits && changes.hasOwnProperty(this.dpTemperatureDisplayUnits)) {
                const newTemperatureDisplayUnits = this._getTemperatureDisplayUnits(changes[this.dpTemperatureDisplayUnits]);
                if (characteristicTemperatureDisplayUnits.value !== newTemperatureDisplayUnits) characteristicTemperatureDisplayUnits.updateValue(newTemperatureDisplayUnits);
            }

            if (changes.hasOwnProperty(this.dpRotationSpeed)) {
                const newRotationSpeed = this._getRotationSpeed(state);
                if (characteristicRotationSpeed.value !== newRotationSpeed) characteristicRotationSpeed.updateValue(newRotationSpeed);
            }
        });
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

    getLockPhysicalControls(callback) {
        this.getState(this.dpChildLock, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getLockPhysicalControls(dp));
        });
    }

    _getLockPhysicalControls(dp) {
        const {Characteristic} = this.hap;

        return dp ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }

    setLockPhysicalControls(value, callback) {
        const {Characteristic} = this.hap;

        switch (value) {
            case Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED:
                return this.setState(this.dpChildLock, true, callback);

            case Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED:
                return this.setState(this.dpChildLock, false, callback);
        }

        callback();
    }

    getCurrentHeaterCoolerState(callback) {
        this.getState([this.dpActive], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getCurrentHeaterCoolerState(dps));
        });
    }

    _getCurrentHeaterCoolerState(dps) {
        const {Characteristic} = this.hap;
        return dps[this.dpActive] ? Characteristic.CurrentHeaterCoolerState.HEATING : Characteristic.CurrentHeaterCoolerState.INACTIVE;
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
        this.setState(this.dpDesiredTemperature, value, err => {
            if (err) return callback(err);

            if (this.characteristicHeatingThresholdTemperature) {
                this.characteristicHeatingThresholdTemperature.updateValue(value);
            }

            callback();
        });
    }

    getTemperatureDisplayUnits(callback) {
        this.getState(this.dpTemperatureDisplayUnits, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getTemperatureDisplayUnits(dp));
        });
    }

    _getTemperatureDisplayUnits(dp) {
        const {Characteristic} = this.hap;

        return dp === 'F' ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS;
    }

    setTemperatureDisplayUnits(value, callback) {
        const {Characteristic} = this.hap;

        this.setState(this.dpTemperatureDisplayUnits, value === Characteristic.TemperatureDisplayUnits.FAHRENHEIT ? 'F' : 'C', callback);
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
        return {[this.cmdLow]: 1, [this.cmdHigh]: 100}[value];
    }

    convertRotationSpeedFromHomeKitToTuya(value) {
        return value < 50 ? this.cmdLow : this.cmdHigh;
    }
}

module.exports = ConvectorAccessory;
