class BaseAccessory {
    constructor(...props) {
        let isNew;
        [this.platform, this.accessory, this.device, isNew = true] = [...props];
        ({log: this.log, api: {hap: this.hap}} = this.platform);

        if (isNew) this._registerPlatformAccessory();

        this.accessory.on('identify', function(paired, callback) {
            // ToDo: Add identification routine
            this.log("%s - identify", this.device.context.name);
            callback();
        }.bind(this));

        this.device.once('connect', () => {
            this.log('Connected to', this.device.context.name);
        });

        this.device.once('change', () => {
            this.log(`Ready to handle ${this.device.context.name} (${this.device.context.type}:${this.device.context.version}) with signature ${JSON.stringify(this.device.state)}`);

            this._registerCharacteristics(this.device.state);
        });

        this.device._connect();
    }

    _registerPlatformAccessory() {
        this.platform.registerPlatformAccessories(this.accessory);
    }

    _checkServiceName(service, name) {
        const {Characteristic} = this.hap;

        if (service.displayName !== name) {
            const nameCharacteristic = service.getCharacteristic(Characteristic.Name) || service.addCharacteristic(Characteristic.Name);
            nameCharacteristic.setValue(name);
            service.displayName = name;
        }
    }

    _removeCharacteristic(service, characteristicType) {
        if (!service || !characteristicType || !characteristicType.UUID) return;

        service.characteristics.some(characteristic => {
            if (!characteristic || characteristic.UUID !== characteristicType.UUID) return false;
            service.removeCharacteristic(characteristic);
            return true;
        });
    }

    _getCustomDP(numeral) {
        return (isFinite(numeral) && parseInt(numeral) > 0) ? String(numeral) : false;
    }

    _coerceBoolean(b, defaultValue) {
        const df = defaultValue || false;
        return typeof b === 'boolean' ? b : (typeof b === 'string' ? b.toLowerCase().trim() === 'true' : (typeof b === 'number' ? b !== 0 : df));
    }

    getState(dp, callback) {
        if (!this.device.connected) return callback(true);
        const _callback = () => {
            if (Array.isArray(dp)) {
                const ret = {};
                dp.forEach(p => {
                    ret[p] = this.device.state[p];
                });
                callback(null, ret);
            } else {
                callback(null, this.device.state[dp]);
            }
        };

        process.nextTick(_callback);
    }

    setState(dp, value, callback) {
        this.setMultiState({[dp.toString()]: value}, callback);
    }

    setMultiState(dps, callback) {
        if (!this.device.connected) return callback(true);

        const ret = this.device.update(dps);
        callback && callback(!ret);
    }

    getDividedState(dp, divisor, callback) {
        this.getState(dp, (err, data) => {
            if (err) return callback(err);
            if (!isFinite(data)) return callback(true);

            callback(null, this._getDividedState(data, divisor));
        });
    }

    _getDividedState(dp, divisor) {
        return (parseFloat(dp) / divisor) || 0;
    }

    _detectColorFunction(value) {
        this.colorFunction = this.device.context.colorFunction && {HSB: 'HSB', HEXHSB: 'HEXHSB'}[this.device.context.colorFunction.toUpperCase()];
        if (!this.colorFunction && value) {
            this.colorFunction = {12: 'HSB', 14: 'HEXHSB'}[value.length] || 'Unknown';
            if (this.colorFunction) console.log(`[Tuya] Color format for ${this.device.context.name} (${this.device.context.version}) identified as ${this.colorFunction} (length: ${value.length}).`);
        }
        if (!this.colorFunction) {
            this.colorFunction = 'Unknown';
            console.log(`[Tuya] Color format for ${this.device.context.name} (${this.device.context.version}) is undetectable.`);
        } else if (this.colorFunction === 'HSB') {
            // If not overridden by config, use the scale of 1000
            if (!this.device.context.scaleBrightness) this.device.context.scaleBrightness = 1000;
            if (!this.device.context.scaleWhiteColor) this.device.context.scaleWhiteColor = 1000;
        }
    }

    convertBrightnessFromHomeKitToTuya(value) {
        const min = this.device.context.minBrightness || 27;
        const scale = this.device.context.scaleBrightness || 255;
        return Math.round(((scale - min) * value + 100 * min - scale) / 99);
    }

    convertBrightnessFromTuyaToHomeKit(value) {
        const min = this.device.context.minBrightness || 27;
        const scale = this.device.context.scaleBrightness || 255;
        return Math.round((99 * (value || 0) - 100 * min + scale) / (scale - min));
    }

    convertColorTemperatureFromHomeKitToTuya(value) {
        const min = this.device.context.minWhiteColor || 140;
        const max = this.device.context.maxWhiteColor || 400;
        const scale = this.device.context.scaleWhiteColor || 255;
        const adjustedValue = (value - 71) * (max - min) / (600 - 71) + 153;
        const convertedValue = Math.round((scale * min / (max - min)) * ((max / adjustedValue) - 1));
        return Math.min(scale, Math.max(0, convertedValue));
    }

    convertColorTemperatureFromTuyaToHomeKit(value) {
        const min = this.device.context.minWhiteColor || 140;
        const max = this.device.context.maxWhiteColor || 400;
        const scale = this.device.context.scaleWhiteColor || 255;
        const unadjustedValue = max / ((value * (max - min) / (scale * min)) + 1);
        const convertedValue = Math.round((unadjustedValue - 153) * (600 - 71) / (max - min) + 71);
        return Math.min(600, Math.max(71, convertedValue));
    }

    convertColorFromHomeKitToTuya(value, dpValue) {
        switch (this.device.context.colorFunction) {
            case 'HSB':
                return this.convertColorFromHomeKitToTuya_HSB(value, dpValue);

            default:
                return this.convertColorFromHomeKitToTuya_HEXHSB(value, dpValue);
        }
    }
    convertColorFromHomeKitToTuya_HEXHSB(value, dpValue) {
        const cached = this.convertColorFromTuya_HEXHSB_ToHomeKit(dpValue || this.device.state[this.dpColor]);
        let {h, s, b} = {...cached, ...value};
        const hsb = h.toString(16).padStart(4, '0') + Math.round(2.55 * s).toString(16).padStart(2, '0') + Math.round(2.55 * b).toString(16).padStart(2, '0');
        h /= 60;
        s /= 100;
        b *= 2.55;

        const
            i = Math.floor(h),
            f = h - i,
            p = b * (1 - s),
            q = b * (1 - s * f),
            t = b * (1 - s * (1 - f)),
            rgb = (() => {
                switch (i % 6) {
                    case 0:
                        return [b, t, p];
                    case 1:
                        return [q, b, p];
                    case 2:
                        return [p, b, t];
                    case 3:
                        return [p, q, b];
                    case 4:
                        return [t, p, b];
                    case 5:
                        return [b, p, q];
                }
            })().map(c => Math.round(c).toString(16).padStart(2, '0')),
            hex = rgb.join('');

        return hex + hsb;
    }

    convertColorFromHomeKitToTuya_HSB(value, dpValue) {
        const cached = this.convertColorFromTuya_HSB_ToHomeKit(dpValue || this.device.state[this.dpColor]);
        let {h, s, b} = {...cached, ...value};
        return h.toString(16).padStart(4, '0') + (10 * s).toString(16).padStart(4, '0') + (10 * b).toString(16).padStart(4, '0');
    }

    convertColorFromTuyaToHomeKit(value) {
        switch (this.device.context.colorFunction) {
            case 'HSB':
                return this.convertColorFromTuya_HSB_ToHomeKit(value);

            default:
                return this.convertColorFromTuya_HEXHSB_ToHomeKit(value);
        }
    }

    convertColorFromTuya_HEXHSB_ToHomeKit(value) {
        const [, h, s, b] = (value || '0000000000ffff').match(/^.{6}([0-9a-f]{4})([0-9a-f]{2})([0-9a-f]{2})$/i) || [0, '0', 'ff', 'ff'];
        return {
            h: parseInt(h, 16),
            s: Math.round(parseInt(s, 16) / 2.55),
            b: Math.round(parseInt(b, 16) / 2.55)
        };
    }

    convertColorFromTuya_HSB_ToHomeKit(value) {
        const [, h, s, b] = (value || '000003e803e8').match(/^([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})$/i) || [0, '0', '3e8', '3e8'];
        return {
            h: parseInt(h, 16),
            s: Math.round(parseInt(s, 16) / 10),
            b: Math.round(parseInt(b, 16) / 10)
        };
    }


    /* Based on works of:
     * Tanner Helland (http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/)
     * Neil Bartlett (http://www.zombieprototypes.com/?p=210)
     */

    convertHomeKitColorTemperatureToHomeKitColor(value) {
        const dKelvin = 10000 / value;
        const rgb = [
            dKelvin > 66 ? 351.97690566805693 + 0.114206453784165 * (dKelvin - 55) - 40.25366309332127 * Math.log(dKelvin - 55) : 255,
            dKelvin > 66 ? 325.4494125711974 + 0.07943456536662342 * (dKelvin - 50) - 28.0852963507957 * Math.log(dKelvin - 55) : 104.49216199393888 * Math.log(dKelvin - 2) - 0.44596950469579133 * (dKelvin - 2) - 155.25485562709179,
            dKelvin > 66 ? 255 : 115.67994401066147 * Math.log(dKelvin - 10) + 0.8274096064007395 * (dKelvin - 10) - 254.76935184120902
        ].map(v => Math.max(0, Math.min(255, v)) / 255);
        const max = Math.max(...rgb);
        const min = Math.min(...rgb);
        let d = max - min,
            h = 0,
            s = max ? 100 * d / max : 0,
            b = 100 * max;

        if (d) {
            switch (max) {
                case rgb[0]: h = (rgb[1] - rgb[2]) / d + (rgb[1] < rgb[2] ? 6 : 0); break;
                case rgb[1]: h = (rgb[2] - rgb[0]) / d + 2; break;
                default: h = (rgb[0] - rgb[1]) / d + 4; break;
            }
            h *= 60;
        }
        return {
            h: Math.round(h),
            s: Math.round(s),
            b: Math.round(b)
        };
    }

    // Checks homebridge version to see if Adaptive Lighting is supported
    adaptiveLightingSupport() {
        return (this.platform.api.versionGreaterOrEqual && this.platform.api.versionGreaterOrEqual('v1.3.0-beta.23'))
    }
}

module.exports = BaseAccessory;
