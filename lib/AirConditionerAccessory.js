const BaseAccessory = require('./BaseAccessory');

const STATE_OTHER = 9;

class AirConditionerAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.AIR_CONDITIONER;
    }

    constructor(...props) {
        super(...props);

        this.cmdCool = 'COOL';
        if (this.device.context.cmdCool) {
            if (/^c[a-z]+$/i.test(this.device.context.cmdCool)) this.cmdCool = ('' + this.device.context.cmdCool).trim();
            else throw new Error('The cmdCool doesn\'t appear to be valid: ' + this.device.context.cmdCool);
        }

        this.cmdHeat = 'HEAT';
        if (this.device.context.cmdHeat) {
            if (/^h[a-z]+$/i.test(this.device.context.cmdHeat)) this.cmdHeat = ('' + this.device.context.cmdHeat).trim();
            else throw new Error('The cmdHeat doesn\'t appear to be valid: ' + this.device.context.cmdHeat);
        }

        this.cmdAuto = 'AUTO';
        if (this.device.context.cmdAuto) {
            if (/^a[a-z]+$/i.test(this.device.context.cmdAuto)) this.cmdAuto = ('' + this.device.context.cmdAuto).trim();
            else throw new Error('The cmdAuto doesn\'t appear to be valid: ' + this.device.context.cmdAuto);
        }

        // Disabling auto mode because I have not found a Tuya device config that has a temperature range for AUTO
        this.device.context.noAuto = true;

        if (!this.device.context.noRotationSpeed) {
            const fanSpeedSteps = (this.device.context.fanSpeedSteps && isFinite(this.device.context.fanSpeedSteps) && this.device.context.fanSpeedSteps > 0 && this.device.context.fanSpeedSteps < 100) ? this.device.context.fanSpeedSteps : 100;
            this._rotationSteps = [0];
            this._rotationStops = {0: 0};
            for (let i = 0; i++ < 100;) {
                const _rotationStep = Math.floor(fanSpeedSteps * (i - 1) / 100) + 1;
                this._rotationSteps.push(_rotationStep);
                this._rotationStops[_rotationStep] = i;
            }
        }
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

        const characteristicActive = service.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps['1']))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        const characteristicCurrentHeaterCoolerState = service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this._getCurrentHeaterCoolerState(dps))
            .on('get', this.getCurrentHeaterCoolerState.bind(this));

        const _validTargetHeaterCoolerStateValues = [STATE_OTHER];
        if (!this.device.context.noCool) _validTargetHeaterCoolerStateValues.unshift(Characteristic.TargetHeaterCoolerState.COOL);
        if (!this.device.context.noHeat) _validTargetHeaterCoolerStateValues.unshift(Characteristic.TargetHeaterCoolerState.HEAT);
        if (!this.device.context.noAuto) _validTargetHeaterCoolerStateValues.unshift(Characteristic.TargetHeaterCoolerState.AUTO);

        const characteristicTargetHeaterCoolerState = service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                maxValue: 9,
                validValues: _validTargetHeaterCoolerStateValues
            })
            .updateValue(this._getTargetHeaterCoolerState(dps['4']))
            .on('get', this.getTargetHeaterCoolerState.bind(this))
            .on('set', this.setTargetHeaterCoolerState.bind(this));

        const characteristicCurrentTemperature = service.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(dps['3'])
            .on('get', this.getState.bind(this, '3'));

        let characteristicSwingMode;
        if (!this.device.context.noSwing) {
            characteristicSwingMode = service.getCharacteristic(Characteristic.SwingMode)
                .updateValue(this._getSwingMode(dps['104']))
                .on('get', this.getSwingMode.bind(this))
                .on('set', this.setSwingMode.bind(this));
        } else this._removeCharacteristic(service, Characteristic.SwingMode);

        let characteristicLockPhysicalControls;
        if (!this.device.context.noChildLock) {
            characteristicLockPhysicalControls = service.getCharacteristic(Characteristic.LockPhysicalControls)
                .updateValue(this._getLockPhysicalControls(dps['6']))
                .on('get', this.getLockPhysicalControls.bind(this))
                .on('set', this.setLockPhysicalControls.bind(this));
        } else this._removeCharacteristic(service, Characteristic.LockPhysicalControls);

        let characteristicCoolingThresholdTemperature;
        if (!this.device.context.noCool) {
            characteristicCoolingThresholdTemperature = service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .setProps({
                    minValue: this.device.context.minTemperature || 10,
                    maxValue: this.device.context.maxTemperature || 35,
                    minStep: this.device.context.minTemperatureSteps || 1
                })
                .updateValue(dps['2'])
                .on('get', this.getState.bind(this, '2'))
                .on('set', this.setTargetThresholdTemperature.bind(this, 'cool'));
        } else this._removeCharacteristic(service, Characteristic.CoolingThresholdTemperature);

        let characteristicHeatingThresholdTemperature;
        if (!this.device.context.noHeat) {
            characteristicHeatingThresholdTemperature = service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .setProps({
                    minValue: this.device.context.minTemperature || 10,
                    maxValue: this.device.context.maxTemperature || 35,
                    minStep: this.device.context.minTemperatureSteps || 1
                })
                .updateValue(dps['2'])
                .on('get', this.getState.bind(this, '2'))
                .on('set', this.setTargetThresholdTemperature.bind(this, 'heat'));
        } else this._removeCharacteristic(service, Characteristic.HeatingThresholdTemperature);

        const characteristicTemperatureDisplayUnits = service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .updateValue(this._getTemperatureDisplayUnits(dps['19']))
            .on('get', this.getTemperatureDisplayUnits.bind(this))
            .on('set', this.setTemperatureDisplayUnits.bind(this));

        let characteristicRotationSpeed;
        if (!this.device.context.noRotationSpeed) {
            characteristicRotationSpeed = service.getCharacteristic(Characteristic.RotationSpeed)
                .updateValue(this._getRotationSpeed(dps))
                .on('get', this.getRotationSpeed.bind(this))
                .on('set', this.setRotationSpeed.bind(this));
        } else this._removeCharacteristic(service, Characteristic.RotationSpeed);

        this.characteristicCoolingThresholdTemperature = characteristicCoolingThresholdTemperature;
        this.characteristicHeatingThresholdTemperature = characteristicHeatingThresholdTemperature;

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty('1')) {
                const newActive = this._getActive(changes['1']);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);

                    if (!changes.hasOwnProperty('4')) {
                        characteristicCurrentHeaterCoolerState.updateValue(this._getCurrentHeaterCoolerState(state));
                    }

                    if (!changes.hasOwnProperty('5')) {
                        characteristicRotationSpeed.updateValue(this._getRotationSpeed(state));
                    }
                }
            }

            if (characteristicLockPhysicalControls && changes.hasOwnProperty('6')) {
                const newLockPhysicalControls = this._getLockPhysicalControls(changes['6']);
                if (characteristicLockPhysicalControls.value !== newLockPhysicalControls) {
                    characteristicLockPhysicalControls.updateValue(newLockPhysicalControls);
                }
            }

            if (changes.hasOwnProperty('2')) {
                if (!this.device.context.noCool && characteristicCoolingThresholdTemperature && characteristicCoolingThresholdTemperature.value !== changes['2'])
                    characteristicCoolingThresholdTemperature.updateValue(changes['2']);
                if (!this.device.context.noHeat && characteristicHeatingThresholdTemperature && characteristicHeatingThresholdTemperature.value !== changes['2'])
                    characteristicHeatingThresholdTemperature.updateValue(changes['2']);
            }

            if (changes.hasOwnProperty('3') && characteristicCurrentTemperature.value !== changes['3']) characteristicCurrentTemperature.updateValue(changes['3']);

            if (changes.hasOwnProperty('4')) {
                const newTargetHeaterCoolerState = this._getTargetHeaterCoolerState(changes['4']);
                const newCurrentHeaterCoolerState = this._getCurrentHeaterCoolerState(state);
                if (characteristicTargetHeaterCoolerState.value !== newTargetHeaterCoolerState) characteristicTargetHeaterCoolerState.updateValue(newTargetHeaterCoolerState);
                if (characteristicCurrentHeaterCoolerState.value !== newCurrentHeaterCoolerState) characteristicCurrentHeaterCoolerState.updateValue(newCurrentHeaterCoolerState);
            }

            if (changes.hasOwnProperty('104')) {
                const newSwingMode = this._getSwingMode(changes['104']);
                if (characteristicSwingMode.value !== newSwingMode) characteristicSwingMode.updateValue(newSwingMode);
            }

            if (changes.hasOwnProperty('19')) {
                const newTemperatureDisplayUnits = this._getTemperatureDisplayUnits(changes['19']);
                if (characteristicTemperatureDisplayUnits.value !== newTemperatureDisplayUnits) characteristicTemperatureDisplayUnits.updateValue(newTemperatureDisplayUnits);
            }

            if (changes.hasOwnProperty('5')) {
                const newRotationSpeed = this._getRotationSpeed(state);
                if (characteristicRotationSpeed.value !== newRotationSpeed) characteristicRotationSpeed.updateValue(newRotationSpeed);

                if (!changes.hasOwnProperty('4')) {
                    characteristicCurrentHeaterCoolerState.updateValue(this._getCurrentHeaterCoolerState(state));
                }
            }
        });
    }

    getActive(callback) {
        this.getState('1', (err, dp) => {
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
                return this.setState('1', true, callback);

            case Characteristic.Active.INACTIVE:
                return this.setState('1', false, callback);
        }

        callback();
    }

    getLockPhysicalControls(callback) {
        this.getState('6', (err, dp) => {
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
                return this.setState('6', true, callback);

            case Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED:
                return this.setState('6', false, callback);
        }

        callback();
    }

    getCurrentHeaterCoolerState(callback) {
        this.getState(['1', '4'], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getCurrentHeaterCoolerState(dps));
        });
    }

    _getCurrentHeaterCoolerState(dps) {
        const {Characteristic} = this.hap;
        if (!dps['1']) return Characteristic.CurrentHeaterCoolerState.INACTIVE;

        switch (dps['4']) {
            case this.cmdCool:
                return Characteristic.CurrentHeaterCoolerState.COOLING;

            case this.cmdHeat:
                return Characteristic.CurrentHeaterCoolerState.HEATING;

            default:
                return Characteristic.CurrentHeaterCoolerState.IDLE;
        }
    }

    getTargetHeaterCoolerState(callback) {
        this.getState('4', (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getTargetHeaterCoolerState(dp));
        });
    }

    _getTargetHeaterCoolerState(dp) {
        const {Characteristic} = this.hap;

        switch (dp) {
            case this.cmdCool:
                if (this.device.context.noCool) return STATE_OTHER;
                return Characteristic.TargetHeaterCoolerState.COOL;

            case this.cmdHeat:
                if (this.device.context.noHeat) return STATE_OTHER;
                return Characteristic.TargetHeaterCoolerState.HEAT;

            case this.cmdAuto:
                if (this.device.context.noAuto) return STATE_OTHER;
                return Characteristic.TargetHeaterCoolerState.AUTO;

            default:
                return STATE_OTHER;
        }
    }

    setTargetHeaterCoolerState(value, callback) {
        const {Characteristic} = this.hap;

        switch (value) {
            case Characteristic.TargetHeaterCoolerState.COOL:
                if (this.device.context.noCool) return callback();
                return this.setState('4', this.cmdCool, callback);

            case Characteristic.TargetHeaterCoolerState.HEAT:
                if (this.device.context.noHeat) return callback();
                return this.setState('4', this.cmdHeat, callback);

            case Characteristic.TargetHeaterCoolerState.AUTO:
                if (this.device.context.noAuto) return callback();
                return this.setState('4', this.cmdAuto, callback);
        }

        callback();
    }

    getSwingMode(callback) {
        this.getState('104', (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getSwingMode(dp));
        });
    }

    _getSwingMode(dp) {
        const {Characteristic} = this.hap;

        return dp ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED;
    }

    setSwingMode(value, callback) {
        if (this.device.context.noSwing) return callback();

        const {Characteristic} = this.hap;

        switch (value) {
            case Characteristic.SwingMode.SWING_ENABLED:
                return this.setState('104', true, callback);

            case Characteristic.SwingMode.SWING_DISABLED:
                return this.setState('104', false, callback);
        }

        callback();
    }

    setTargetThresholdTemperature(mode, value, callback) {
        this.setState('2', value, err => {
            if (err) return callback(err);

            if (mode === 'cool' && !this.device.context.noHeat && this.characteristicHeatingThresholdTemperature) {
                this.characteristicHeatingThresholdTemperature.updateValue(value);
            } else if (mode === 'heat' && !this.device.context.noCool && this.characteristicCoolingThresholdTemperature) {
                this.characteristicCoolingThresholdTemperature.updateValue(value);
            }

            callback();
        });
    }

    getTemperatureDisplayUnits(callback) {
        this.getState('19', (err, dp) => {
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

        this.setState('19', value === Characteristic.TemperatureDisplayUnits.FAHRENHEIT ? 'F' : 'C', callback);
    }

    getRotationSpeed(callback) {
        this.getState(['1', '5'], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getRotationSpeed(dps));
        });
    }

    _getRotationSpeed(dps) {
        if (!dps['1']) return 0;

        if (this._hkRotationSpeed) {
            const currntRotationSpeed = this.convertRotationSpeedFromHomeKitToTuya(this._hkRotationSpeed);

            return currntRotationSpeed === dps['5'] ? this._hkRotationSpeed : this.convertRotationSpeedFromTuyaToHomeKit(dps['5']);
        }

        return this._hkRotationSpeed = this.convertRotationSpeedFromTuyaToHomeKit(dps['5']);
    }

    setRotationSpeed(value, callback) {
        const {Characteristic} = this.hap;

        if (value === 0) {
            this.setActive(Characteristic.Active.INACTIVE, callback);
        } else {
            this._hkRotationSpeed = value;
            this.setMultiState({'1': true, '5': this.convertRotationSpeedFromHomeKitToTuya(value)}, callback);
        }
    }

    convertRotationSpeedFromTuyaToHomeKit(value) {
        return this._rotationStops[parseInt(value)];
    }

    convertRotationSpeedFromHomeKitToTuya(value) {
        return this.device.context.fanSpeedSteps ? '' + this._rotationSteps[value] : this._rotationSteps[value];
    }
}

module.exports = AirConditionerAccessory;