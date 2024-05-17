const BaseAccessory = require('./BaseAccessory');
const async = require('async');

class StarProjectorAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.LIGHT;
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

        const lightName = 'RGBTWLight - ' + this.device.context.name;
        let lightService = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, 'lightbulb');
        if (lightService) this._checkServiceName(lightService, lightName);
        else lightService = this.accessory.addService(Service.Lightbulb, lightName, 'lightbulb');

        const switchName = this.device.context.name + ' Rotation';
        let switchService = this.accessory.getServiceByUUIDAndSubType(Service.Switch, 'switch');
        if (switchService) this._checkServiceName(outletService, switchName);
        else switchService = this.accessory.addService(Service.Switch, switchName, 'switch');

        this.accessory.services
            .forEach(service => {
                if ((service.UUID === Service.Outlet.UUID && service !== outletService) || (service.UUID === Service.Lightbulb.UUID && service !== lightService))
                    this.accessory.removeService(service);
            });
    }

    _registerCharacteristics(dps) {
        this._verifyCachedPlatformAccessory();

        const {Service, Characteristic, EnergyCharacteristics} = this.hap;

        const lightService = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, 'lightbulb');
        const switchService = this.accessory.getServiceByUUIDAndSubType(Service.Switch, 'switch');

        this.dpLight = this._getCustomDP(this.device.context.dpLight) || '1';
        this.dpMode = this._getCustomDP(this.device.context.dpMode) || '2';
        this.dpBrightness = this._getCustomDP(this.device.context.dpBrightness) || '3';
        this.dpColorTemperature = this._getCustomDP(this.device.context.dpColorTemperature) || '4';
        this.dpColor = this._getCustomDP(this.device.context.dpColor) || '5';

        this.dpMotor = this._getCustomDP(this.device.context.dpMotor) || '101';

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

        const characteristicLightOn = lightService.getCharacteristic(Characteristic.On)
            .updateValue(dps[this.dpLight])
            .on('get', this.getState.bind(this, this.dpLight))
            .on('set', this.setState.bind(this, this.dpLight));

        const characteristicBrightness = lightService.getCharacteristic(Characteristic.Brightness)
            .updateValue(dps[this.dpMode] === this.cmdWhite ? this.convertBrightnessFromTuyaToHomeKit(dps[this.dpBrightness]) : this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).b)
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
            .updateValue(dps[this.dpMode] === this.cmdWhite ? 0 : this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).h)
            .on('get', this.getHue.bind(this))
            .on('set', this.setHue.bind(this));

        const characteristicSaturation = lightService.getCharacteristic(Characteristic.Saturation)
            .updateValue(dps[this.dpMode] === this.cmdWhite ? 0 : this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).s)
            .on('get', this.getSaturation.bind(this))
            .on('set', this.setSaturation.bind(this));

        this.characteristicHue = characteristicHue;
        this.characteristicSaturation = characteristicSaturation;
        this.characteristicColorTemperature = characteristicColorTemperature;

        const characteristicSwitchOn = switchService.getCharacteristic(Characteristic.On)
            .updateValue(dps[this.dpMotor])
            .on('get', this.getState.bind(this, this.dpMotor))
            .on('set', this.setState.bind(this, this.dpMotor));

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpLight) && characteristicLightOn.value !== changes[this.dpLight]) characteristicLightOn.updateValue(changes[this.dpLight]);

            switch (state[this.dpMode]) {
                case this.cmdWhite:
                    if (changes.hasOwnProperty(this.dpBrightness) && this.convertBrightnessFromHomeKitToTuya(characteristicBrightness.value) !== changes[this.dpBrightness])
                        characteristicBrightness.updateValue(this.convertBrightnessFromTuyaToHomeKit(changes[this.dpBrightness]));

                    if (changes.hasOwnProperty(this.dpColorTemperature) && this.convertColorTemperatureFromHomeKitToTuya(characteristicColorTemperature.value) !== changes[this.dpColorTemperature]) {

                        const newColorTemperature = this.convertColorTemperatureFromTuyaToHomeKit(changes[this.dpColorTemperature]);
                        const newColor = this.convertHomeKitColorTemperatureToHomeKitColor(newColorTemperature);

                        characteristicHue.updateValue(newColor.h);
                        characteristicSaturation.updateValue(newColor.s);
                        characteristicColorTemperature.updateValue(newColorTemperature);

                    } else if (changes[this.dpMode] && !changes.hasOwnProperty(this.dpColorTemperature)) {

                        const newColorTemperature = this.convertColorTemperatureFromTuyaToHomeKit(state[this.dpColorTemperature]);
                        const newColor = this.convertHomeKitColorTemperatureToHomeKitColor(newColorTemperature);

                        characteristicHue.updateValue(newColor.h);
                        characteristicSaturation.updateValue(newColor.s);
                        characteristicColorTemperature.updateValue(newColorTemperature);
                    }

                    break;

                default:
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

                        if (characteristicColorTemperature.value !== 0) characteristicColorTemperature.updateValue(0);

                    } else if (changes[this.dpMode]) {
                        if (characteristicColorTemperature.value !== 0) characteristicColorTemperature.updateValue(0);
                    }
            }

            if (changes.hasOwnProperty(this.dpPower) && characteristicSwitchOn.value !== changes[this.dpPower]) characteristicSwitchOn.updateValue(changes[this.dpPower]);

        });
    }

    getBrightness(callback) {
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, this.convertBrightnessFromTuyaToHomeKit(this.device.state[this.dpBrightness]));
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).b);
    }

    setBrightness(value, callback) {
        if (this.device.state[this.dpMode] === this.cmdWhite) return this.setState(this.dpBrightness, this.convertBrightnessFromHomeKitToTuya(value), callback);
        this.setState(this.dpColor, this.convertColorFromHomeKitToTuya({b: value}), callback);
    }

    getColorTemperature(callback) {
        if (this.device.state[this.dpMode] !== this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorTemperatureFromTuyaToHomeKit(this.device.state[this.dpColorTemperature]));
    }

    setColorTemperature(value, callback) {
        if (value === 0) return callback(null, true);

        const newColor = this.convertHomeKitColorTemperatureToHomeKitColor(value);
        this.characteristicHue.updateValue(newColor.h);
        this.characteristicSaturation.updateValue(newColor.s);

        this.setMultiState({[this.dpMode]: this.cmdWhite, [this.dpColorTemperature]: this.convertColorTemperatureFromHomeKitToTuya(value)}, callback);
    }

    getHue(callback) {
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).h);
    }

    setHue(value, callback) {
        this._setHueSaturation({h: value}, callback);
    }

    getSaturation(callback) {
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, 0);
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

        //this.characteristicColorTemperature.updateValue(0);

        const callbacks = this._pendingHueSaturation.callbacks;
        const callEachBack = err => {
            async.eachSeries(callbacks, (callback, next) => {
                try {
                    callback(err);
                } catch (ex) {}
                next();
            }, () => {
                this.characteristicColorTemperature.updateValue(0);
            });
        };

        const isSham = this._pendingHueSaturation.props.h === 0 && this._pendingHueSaturation.props.s === 0;
        const newValue = this.convertColorFromHomeKitToTuya(this._pendingHueSaturation.props);
        this._pendingHueSaturation = null;

        if (this.device.state[this.dpMode] === this.cmdWhite && isSham) return callEachBack();

        this.setMultiState({[this.dpMode]: this.cmdColor, [this.dpColor]: newValue}, callEachBack);
    }
}

module.exports = StarProjectorAccessory;
