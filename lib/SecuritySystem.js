const BaseAccessory = require('./BaseAccessory');

class SecuritySystem extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.SECURITY_SYSTEM;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;
        this.accessory.addService(Service.SecuritySystem, this.device.context.name);
        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const service = this.accessory.getService(Service.SecuritySystem);
        this._checkServiceName(service, this.device.context.name);

        this.dpStatus = this._getCustomDP(this.device.context.dpSecurityTargetMode) || '32';
        this.dpMode = this._getCustomDP(this.device.context.dpSecuritySetMode) || '1';
        this.dpBatteryLevel = this._getCustomDP(this.device.context.dpBatteryLevel) || '16';
        
        this.debug = this.device.context.debug == true;
        
        const characteristicSecuritySystemTargetState = service.getCharacteristic(Characteristic.SecuritySystemTargetState)
            .setProps({
                validValues: [0, 1, 3],
                minValue: 0,
                maxValue: 3
            })
            .updateValue(this._getMode(dps[this.dpMode]))
            .on('get', this.getMode.bind(this))
            .on('set', this.setMode.bind(this));

        const characteristicSecuritySystemCurrentState = service.getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .setProps({
                validValues: [0, 1, 3, 4],
                minValue: 0,
                maxValue: 4
            })
            .updateValue(this._getSecuritySystemCurrentState(dps[this.dpStatus]))
            .on('get', this.getSecuritySystemCurrentState.bind(this));

        const characteristicBatteryLevel = service.getCharacteristic(Characteristic.BatteryLevel)
            .updateValue(this._getBatteryLevel(dps[this.dpBatteryLevel]))
            .on('get', this.getBatteryLevel.bind(this));

        this.device.on('change', (changed, state) => {
            const changes = state;
            if (characteristicSecuritySystemTargetState && changes.hasOwnProperty(this.dpMode)) {
                const newSecuritySystemTargetState = this._getMode(changes[this.dpMode]);
                if (characteristicSecuritySystemTargetState.value !== newSecuritySystemTargetState) {
                    characteristicSecuritySystemTargetState.updateValue(newSecuritySystemTargetState);
                }
            }

            if (changes.hasOwnProperty(this.dpStatus)) {
                const newSecuritySystemCurrentState = this._getSecuritySystemCurrentState(changes[this.dpStatus]);
                if (characteristicSecuritySystemCurrentState.value !== newSecuritySystemCurrentState) {
                    characteristicSecuritySystemCurrentState.updateValue(newSecuritySystemCurrentState);
                }
            }

            if (changes.hasOwnProperty(this.dpBatteryLevel)) {
                const newBatteryLevel = this._getBatteryLevel(changes[this.dpBatteryLevel]);
                if (characteristicBatteryLevel.value !== newBatteryLevel) {
                    characteristicBatteryLevel.updateValue(newBatteryLevel);
                }
            }

        });
    }

    getSecuritySystemCurrentState(callback) {
        this.getState(this.dpStatus, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getSecuritySystemCurrentState(dp));
        });
    }

    _getSecuritySystemCurrentState(dp) {
        switch (dp) {
            case 'alarm':
                return 4;
            default:
                return this._getMode(this.device.state[this.dpMode]);
        }
    }

    getMode(callback) {
        this.getState(this.dpMode, (err, dp) => {
            if (err) {
                return callback(err);
            }
            callback(null, this._getMode(dp));
        });
     }
    
    _getMode(dp) {
        switch(dp) {
            case "arm":
                return 1;
            case "home":
                return 0;
            default:
                return 3;
        }
     }
     
    getBatteryLevel(callback) {
        this.getState(this.dpBatteryLevel, (err, dp) => {
            if (err) {
                return callback(err);
        }
        callback(null, this._getBatteryLevel(dp));
    });
    }
    
    _getBatteryLevel(dp) {
        return dp;
    }

    setMode(value, callback) {

        if (this.debug) {
            console.log("setMode: " + value);
        }
        
        var newMode = "disarmed"

        if (value == 0) {
            newMode = "home"
        }
        
        if (value == 1) {
            newMode = "arm"
        }
        
        this.setState(this.dpMode, newMode, err => {
            if (err) {
                if (this.debug) {
                    console.log("Tuya SecuritySystem -->> errot set mode set: " + err);
                }
                return callback(err);
            }
            if (this.characteristicSecuritySystemTargetState) {
                this.characteristicSecuritySystemTargetState.updateValue(value);
                if (this.debug) {
                    console.log("Tuya SecuritySystem -->> Security mode set to: " + newMode);
                }
            }
            callback();
        });
    }

}

module.exports = SecuritySystem;
