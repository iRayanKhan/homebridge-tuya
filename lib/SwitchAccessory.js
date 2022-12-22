const BaseAccessory = require('./BaseAccessory');
const async = require('async');

class SwitchAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.SWITCH;
    }

    constructor(...props) {
        super(...props);
        ({log: this.log} = this.platform);
    }

    _registerPlatformAccessory() {
        this._verifyCachedPlatformAccessory();
        this._justRegistered = true;

        super._registerPlatformAccessory();
    }

    _verifyCachedPlatformAccessory() {
        //const signature =  JSON.stringify(this.device.state);
        const signature =  this.device.state;
        //console.log("sig: ", signature);

        if (this._justRegistered) return;

        const {Service} = this.hap;

        let switchCount = 0;
        const backlightId = (this.device.context.backlightId || 16).toString();//default backlight id is 16, but it can be overrided in plugin settings
        //console.log("sig keys: " + signature.keys);
        //get switch count
        for (let i in signature){
            //console.log("value: " + parseInt(signature[i]))
            if (parseInt(i) < 7){//max gangs is 6
                //console.log("SW++")
                switchCount = switchCount + 1;
                //console.log("SWcount: " + switchCount);
            }
        }
        //override switchcount if set in plugin settings
        //const switchCount = parseInt(this.device.context.switchCount) || 1;
        if (this.device.context.switchCount){
            switchCount = parseInt(this.device.context.switchCount);
        }
        this.log(`[TUYA] SwitchCount: ${switchCount}, backlightId: ${backlightId}`);
        const _validServices = [];
        //add switches
        for (let i = 0; i++ < switchCount;) {
            let service = this.accessory.getServiceByUUIDAndSubType(Service.Switch, 'switch ' + i);
            if (service) this._checkServiceName(service, this.device.context.name + ' ' + i);
            else service = this.accessory.addService(Service.Switch, this.device.context.name + ' ' + i, 'switch ' + i);

            _validServices.push(service);
        }

        //add backlight if available - default object 16
        if (typeof(signature[backlightId]) != "undefined"){
            //console.log("This switch has a backlight, we add it as a button");
            let service = this.accessory.getServiceByUUIDAndSubType(Service.Switch, 'switch ' + backlightId);
            if (service) this._checkServiceName(service, this.device.context.name + ' backlight');
            else service = this.accessory.addService(Service.Switch, this.device.context.name + ' ' + "backlight", 'switch ' + backlightId);

            _validServices.push(service);
        }

        this.accessory.services
            .filter(service => service.UUID === Service.Switch.UUID && !_validServices.includes(service))
            .forEach(service => {
                this.log('Removing', service.displayName);
                this.accessory.removeService(service);
            });
    }

    _registerCharacteristics(dps) {
        this._verifyCachedPlatformAccessory();

        const {Service, Characteristic} = this.hap;

        const characteristics = {};
        this.accessory.services.forEach(service => {
            if (service.UUID !== Service.Switch.UUID || !service.subtype) return false;

            let match;
            if ((match = service.subtype.match(/^switch (\d+)$/)) === null) return;

            characteristics[match[1]] = service.getCharacteristic(Characteristic.On)
                .updateValue(dps[match[1]])
                .on('get', this.getPower.bind(this, match[1]))
                .on('set', this.setPower.bind(this, match[1]));
        });

        this.device.on('change', (changes, state) => {
            Object.keys(changes).forEach(key => {
                if (characteristics[key] && characteristics[key].value !== changes[key]) characteristics[key].updateValue(changes[key]);
            });
        });
    }

    getPower(dp, callback) {
        callback(null, this.device.state[dp]);
    }

    setPower(dp, value, callback) {
        if (!this._pendingPower) {
            this._pendingPower = {props: {}, callbacks: []};
        }

        if (dp) {
            if (this._pendingPower.timer) clearTimeout(this._pendingPower.timer);

            this._pendingPower.props = {...this._pendingPower.props, ...{[dp]: value}};
            this._pendingPower.callbacks.push(callback);

            //this._pendingPower.timer = setTimeout(() => {
                this.setPower();
            //}, 500);
            return;
        }

        const callbacks = this._pendingPower.callbacks;
        const callEachBack = err => {
            async.eachSeries(callbacks, (callback, next) => {
                try {
                    callback(err);
                } catch (ex) {}
                next();
            });
        };

        const newValue = this._pendingPower.props;
        this._pendingPower = null;

        this.setMultiState(newValue, callEachBack);
    }
}

module.exports = SwitchAccessory;
