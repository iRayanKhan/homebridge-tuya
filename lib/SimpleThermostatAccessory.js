const BaseAccessory = require('./BaseAccessory');

class SimpleThermostatAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.AIR_HEATER;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const { Service } = this.hap;

        this.accessory.addService(Service.HeaterCooler, this.device.context.name);

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const { Service, Characteristic } = this.hap;
        const service = this.accessory.getService(Service.HeaterCooler);
        this._checkServiceName(service, this.device.context.name);

        this.deviceName = this.device.context.name || 'Thermostat';
        this.dpActive = this._getCustomDP(this.device.context.dpActive) || '1';
        this.dpProgramState = this._getCustomDP(this.device.context.dpProgramState) || '1';
        this.dpDesiredTemperature = this._getCustomDP(this.device.context.dpDesiredTemperature) || '2';
        this.dpCurrentTemperature = this._getCustomDP(this.device.context.dpCurrentTemperature) || '3';
        this.temperatureDivisor = parseInt(this.device.context.temperatureDivisor) || 1;
        this.thresholdTemperatureDivisor = parseInt(this.device.context.thresholdTemperatureDivisor) || 1;
        this.targetTemperatureDivisor = parseInt(this.device.context.targetTemperatureDivisor) || 1;
        this.heatingIndicatorOff = this.device.context.heatingIndicatorOff || 'warming';
        this.heatingIndicatorOn = this.device.context.heatingIndicatorOn || 'heating';
        this.scheduledHeatingOff = this.device.context.scheduledHeatingOff || 'FROST';
        this.scheduledHeatingOn = this.device.context.scheduledHeatingOn || 'AUTO';
        this.activeStateNotBool = this.device.context.dpActiveNotBoolean || false;
        this.programStateNotBool = this.device.context.dpProgramStateNotBoolean || false;

        const characteristicActive = service.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps[this.dpProgramState]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        const characteristicCurrentHeaterCoolerState = service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this._getCurrentHeaterCoolerState(dps))
            .on('get', this.getCurrentHeaterCoolerState.bind(this));

        service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                minValue: 1,
                maxValue: 1,
                validValues: [Characteristic.TargetHeaterCoolerState.HEAT]
            })
            .updateValue(this._getTargetHeaterCoolerState())
            .on('get', this.getTargetHeaterCoolerState.bind(this));

        const characteristicCurrentTemperature = service.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(this._getDividedState(dps[this.dpCurrentTemperature], this.temperatureDivisor))
            .on('get', this.getDividedState.bind(this, this.dpCurrentTemperature, this.temperatureDivisor));


        const characteristicHeatingThresholdTemperature = service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: this.device.context.minTemperature || 15,
                maxValue: this.device.context.maxTemperature || 35,
                minStep: this.device.context.minTemperatureSteps || 0.5
            })
            .updateValue(this._getDividedState(dps[this.dpDesiredTemperature], this.thresholdTemperatureDivisor))
            .on('get', this.getDividedState.bind(this, this.dpDesiredTemperature, this.thresholdTemperatureDivisor))
            .on('set', this.setTargetThresholdTemperature.bind(this));

        this.characteristicHeatingThresholdTemperature = characteristicHeatingThresholdTemperature;

        this.device.on('change', (changes, state) => {

            if (changes.hasOwnProperty(this.dpProgramState)) {
                const newActive = this._getActive(changes[this.dpProgramState]);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);
                }
            }

            if (changes.hasOwnProperty(this.dpDesiredTemperature)) {
                if (characteristicHeatingThresholdTemperature.value !== changes[this.dpDesiredTemperature])
                    characteristicHeatingThresholdTemperature.updateValue(changes[this.dpDesiredTemperature] / this.targetTemperatureDivisor);
            }

            if (changes.hasOwnProperty(this.dpActive)) {
                const newCurrentHeaterCoolerState = this._getCurrentHeaterCoolerState(changes[this.dpActive]);
                if (characteristicCurrentHeaterCoolerState.value !== newCurrentHeaterCoolerState) {
                    characteristicCurrentHeaterCoolerState.updateValue(newCurrentHeaterCoolerState);
                }
            }

            if (changes.hasOwnProperty(this.dpCurrentTemperature) && characteristicCurrentTemperature.value !== changes[this.dpCurrentTemperature]) characteristicCurrentTemperature.updateValue(this._getDividedState(changes[this.dpCurrentTemperature], this.temperatureDivisor));

            console.log('[Tuya] ' + this.deviceName + ' changed: ' + JSON.stringify(state));
        });
    }

    getActive(callback) {
        this.getState(this.dpProgramState, (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getActive(dp));
        });
    }

    _getActive(dp) {
        const { Characteristic } = this.hap;
        if (this.programStateNotBool == true) {
            return dp == this.scheduledHeatingOff ? Characteristic.Active.INACTIVE : Characteristic.Active.ACTIVE;
        } else { return dp ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE; }
    }

    setActive(value, callback) {
        const { Characteristic } = this.hap;

        switch (value) {
            case Characteristic.Active.ACTIVE:
                if (this.programStateNotBool == true) { return this.setState(this.dpProgramState, this.scheduledHeatingOn, callback); }
                else { return this.setState(this.dpProgramState, true, callback); }

            case Characteristic.Active.INACTIVE:
                if (this.programStateNotBool == true) { return this.setState(this.dpProgramState, this.scheduledHeatingOff, callback); }
                else { return this.setState(this.dpProgramState, false, callback); }
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
        const { Characteristic } = this.hap;
        if (this.activeStateNotBool == true) {
            return dps == this.heatingIndicatorOn ? Characteristic.CurrentHeaterCoolerState.HEATING : Characteristic.CurrentHeaterCoolerState.IDLE;
        } else { return dps ? Characteristic.CurrentHeaterCoolerState.HEATING : Characteristic.CurrentHeaterCoolerState.IDLE; }
    }

    getTargetHeaterCoolerState(callback) {
        callback(null, this._getTargetHeaterCoolerState());
    }

    _getTargetHeaterCoolerState() {
        const { Characteristic } = this.hap;
        return Characteristic.TargetHeaterCoolerState.HEAT;
    }

    setTargetThresholdTemperature(value, callback) {
        this.setState(this.dpDesiredTemperature, value * this.thresholdTemperatureDivisor, err => {
            if (err) return callback(err);

            if (this.characteristicHeatingThresholdTemperature) {
                this.characteristicHeatingThresholdTemperature.updateValue(value);
            }

            callback();
        });
    }
}

module.exports = SimpleThermostatAccessory;
