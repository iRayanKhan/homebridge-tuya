const BaseAccessory = require('./BaseAccessory');
const async = require('async');

class RGBLightAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.LIGHTBULB;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        this.accessory.addService(Service.Lightbulb, this.device.context.name);

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const service = this.accessory.getService(Service.Lightbulb);
        this._checkServiceName(service, this.device.context.name);

        this.dpPower = this._getCustomDP(this.device.context.dpPower) || '1';
        this.dpMode = this._getCustomDP(this.device.context.dpMode) || '2';
        this.dpBrightness = this._getCustomDP(this.device.context.dpBrightness) || '3';
        this.dpColor = this._getCustomDP(this.device.context.dpColor) || '5';

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

                const characteristicOn = service.getCharacteristic(Characteristic.On)
                    .updateValue(dps[this.dpPower])
                    .on('get', this.getState.bind(this, this.dpPower))
                    .on('set', this.setState.bind(this, this.dpPower));

                const characteristicBrightness = service.getCharacteristic(Characteristic.Brightness)
                    .updateValue(dps[this.dpMode] === this.cmdWhite ? this.convertBrightnessFromTuyaToHomeKit(dps[this.dpBrightness]) : this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).b)
                    .on('get', this.getBrightness.bind(this))
                    .on('set', this.setBrightness.bind(this));

                const characteristicHue = service.getCharacteristic(Characteristic.Hue)
                    .updateValue(dps[this.dpMode] === this.cmdWhite ? 0 : this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).h)
                    .on('get', this.getHue.bind(this))
                    .on('set', this.setHue.bind(this));

                const characteristicSaturation = service.getCharacteristic(Characteristic.Saturation)
                    .updateValue(dps[this.dpMode] === this.cmdWhite ? 0 : this.convertColorFromTuyaToHomeKit(dps[this.dpColor]).s)
                    .on('get', this.getSaturation.bind(this))
                    .on('set', this.setSaturation.bind(this));

                this.characteristicHue = characteristicHue;
                this.characteristicSaturation = characteristicSaturation;

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpPower) && characteristicOn.value !== changes[this.dpPower]) characteristicOn.updateValue(changes[this.dpPower]);

            switch (state[this.dpMode]) {
                case this.cmdWhite:
                    if (changes.hasOwnProperty(this.dpBrightness) && this.convertBrightnessFromHomeKitToTuya(characteristicBrightness.value) !== changes[this.dpBrightness])
                        characteristicBrightness.updateValue(this.convertBrightnessFromTuyaToHomeKit(changes[this.dpBrightness]));
                    break;

                default:
                    if (changes.hasOwnProperty(this.dpColor)) {
                        const oldColor = this.convertColorFromTuyaToHomeKit(this.convertColorFromHomeKitToTuya({
                            h: characteristicHue.value,
                            s: characteristicSaturation.value,
                            b: characteristicBrightness.value
                        }));
                        const newColor = this.convertColorFromTuyaToHomeKit(changes[this.dpColor]);

                        if (oldColor.b !== newColor.b) characteristicBrightness.updateValue(newColor.b);
                        if (oldColor.h !== newColor.h) characteristicHue.updateValue(newColor.h);

                        if (oldColor.s !== newColor.s) characteristicSaturation.updateValue(newColor.h);
                    }
            }
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


        if (this.device.state[this.dpMode] === this.cmdWhite && isSham) return callEachBack();

        this.setMultiState({[this.dpMode]: this.cmdColor, [this.dpColor]: newValue}, callEachBack);
    }
}

module.exports = RGBLightAccessory;
