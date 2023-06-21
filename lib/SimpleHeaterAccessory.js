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
        this.dpHeatingCapacity = this._getCustomDP(this.device.context.dpHeatingCapacity) || null;
        this.dpHeatingCapacityIdleValue = this._getCustomDP(this.device.context.dpHeatingCapacityIdleValue) || 0;
        this.temperatureDivisor = parseInt(this.device.context.temperatureDivisor) || 1;
        this.thresholdTemperatureDivisor = parseInt(this.device.context.thresholdTemperatureDivisor) || 1;
        this.targetTemperatureDivisor = parseInt(this.device.context.targetTemperatureDivisor) || 1;

        const characteristicActive = service.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps[this.dpActive]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        const characteristicCurrentHeaterCoolerState = service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this._getCurrentHeaterCoolerState(dps))
            .on('get', this.getCurrentHeaterCoolerState.bind(this));
        this.characteristicCurrentHeaterCoolerState = characteristicCurrentHeaterCoolerState;

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
            .updateValue(this._getDividedState(dps[this.dpCurrentTemperature], this.temperatureDivisor))
            .on('get', this.getDividedState.bind(this, this.dpCurrentTemperature, this.temperatureDivisor));


        const characteristicHeatingThresholdTemperature = service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: this.device.context.minTemperature || 15,
                maxValue: this.device.context.maxTemperature || 35,
                minStep: this.device.context.minTemperatureSteps || 1
            })
            .updateValue(this._getDividedState(dps[this.dpDesiredTemperature], this.thresholdTemperatureDivisor))
            .on('get', this.getDividedState.bind(this, this.dpDesiredTemperature, this.thresholdTemperatureDivisor))
            .on('set', this.setTargetThresholdTemperature.bind(this));

        this.characteristicHeatingThresholdTemperature = characteristicHeatingThresholdTemperature;

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpActive)) {
                const newActive = this._getActive(changes[this.dpActive]);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);
                }
            }

            if (changes.hasOwnProperty(this.dpDesiredTemperature)) {
                if (characteristicHeatingThresholdTemperature.value !== changes[this.dpDesiredTemperature])
                    characteristicHeatingThresholdTemperature.updateValue(changes[this.dpDesiredTemperature * this.targetTemperatureDivisor]);
            }

            if (changes.hasOwnProperty(this.dpCurrentTemperature) && characteristicCurrentTemperature.value !== changes[this.dpCurrentTemperature]) characteristicCurrentTemperature.updateValue(this._getDividedState(changes[this.dpCurrentTemperature], this.temperatureDivisor));
            
            if (changes.hasOwnProperty(this.dpActive) ||
                changes.hasOwnProperty(this.dpDesiredTemperature) ||
                changes.hasOwnProperty(this.dpCurrentTemperature) ||
                (this.dpHeatingCapacity != null && changes.hasOwnProperty(this.dpHeatingCapacity))) {
                this.characteristicCurrentHeaterCoolerState.updateValue(this._getCurrentHeaterCoolerState(state));
            }

            this.log.info('SimpleHeater changed: ' + JSON.stringify(state));
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

    getCurrentHeaterCoolerState(callback) {
        let dps = [this.dpActive, this.dpCurrentTemperature, this.dpDesiredTemperature]
        if (this.dpHeatingCapacity != null) dps.push(this.dpHeatingCapacity)
        this.getState(dps, (err, dps_values) => {
            if (err) return callback(err);

            callback(null, this._getCurrentHeaterCoolerState(dps_values));
        });
    }

    _getCurrentHeaterCoolerState(dps) {
        const {Characteristic} = this.hap;

        if (!dps[this.dpActive]) return Characteristic.CurrentHeaterCoolerState.INACTIVE;

        if (this.dpHeatingCapacity == null) { // If dpHeatingCapacity isn't provided, we assume that the heater is heating when currentTemp <= desiredTemp and idle otherwise
            return dps[this.dpCurrentTemperature] <= dps[this.dpDesiredTemperature] ? Characteristic.CurrentHeaterCoolerState.HEATING : Characteristic.CurrentHeaterCoolerState.IDLE;
        } else { // If dpHeatingCapacity is provided, we assume that the heater is heating when heatingCapacity != idleValue and idle otherwise
            return dps[this.dpHeatingCapacity] != this.dpHeatingCapacityIdleValue ? Characteristic.CurrentHeaterCoolerState.HEATING : Characteristic.CurrentHeaterCoolerState.IDLE;
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
        this.setState(this.dpDesiredTemperature, value * this.thresholdTemperatureDivisor, err => {
            if (err) return callback(err);

            if (this.characteristicHeatingThresholdTemperature) {
                this.characteristicHeatingThresholdTemperature.updateValue(value);
            }

            callback();
        });
    }
}

module.exports = SimpleHeaterAccessory;
