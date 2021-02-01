const BaseAccessory = require('./BaseAccessory');

const DP_SWITCH = '1';
const DP_PM25 = '2';
const DP_MODE = '3'
const DP_FAN_SPEED = '4';
const DP_LOCK_PHYSICAL_CONTROLS = '7';
const DP_AIR_QUALITY = '22';

const STATE_OTHER = 9;

/**
 * Accessory for Air Purifiers, with an optional setting to also include Air Quality sensor details.
 *
 *
 * Extra settings:
 * - noRotationSpeed - boolean which, if set to true, will disable the fan speed control
 * - fanSpeedSteps -   The number of fan speed stops that the device supports. The default is 100.
 * - showAirQuality -  boolean for enabling the air quality service. The default is false, which
 *                     will not include air quality values.
 * - nameAirQuality -  Allows customisation of the air quality sensor name. Default is 'Air Quality'
 * - noChildLock -     boolean for disabling the child lock feature. The default is false, which
 *                     will enable the child lock feature
 *
 * Standard Air Purifier Data Points (dp):
 * 1. switch
 * 2. pm25
 * 3. mode
 * 4. fan_speed_enum
 * 5. filter (Filter Usage)
 * 6. anion
 * 7. child_lock
 * 8. light
 * 9. uv (UV Disinfection)
 * 10. wet (Humidify)
 * 11. filter_reset (Reset Filter)
 * 12. temp_indoor (Indoor Temp)
 * 13. humidity (Indoor Humidity)
 * 14. tvoc
 * 15. eco2 (eCO2)
 * 16. filter_days (Filter Days Left)
 * 17. total_runtime
 * 18. countdown_sete
 * 19. countdown_left
 * 20. total_pm
 * 21. ???
 * 22. air_quality (verified on Breville Smart Air Connect)
 * ???. fault (Fault Alarm)
 *
 * This accessory maps the DP ids to the following Characteristics:
 * - 1 - Characteristic.ACTIVE / Characteristic.CurrentAirPurifierState
 * - 2 - Characteristic.PM2_5Density / Characteristic.AirQuality
 * - 3 - Characteristic.TargetAirPurifierState
 * - 4 - Characteristic.RotationSpeed
 * - 7 - Characteristic.LockPhysicalControls
 *
 * Device compatability:
 * - Some devices, like the Breville Smart Air Connect, return and expect text rather than numeric Characteristics. To handle these properly, ensure that you set the 'manufacturer' configuration to 'Breville'.
 *
 * Future Enhancements:
 * - Some of this implementation is very similar to AirConditionerAccessory. Likely some scope
 *   for refactoring this.
 * - Some air purifiers support more of the standard data points than the original test device,
 *   so additional services like Filter Maintenance could be added
 *   https://developers.homebridge.io/#/service/FilterMaintenance
 * - _getAirQuality currenly calculates a value based on the pm25 value. I do not have a device
 *   that supports the air_quality data point to see what the return type would be
 *
 * Notes:
 * Initial testing was performed on a Elechomes KJ200G-A3B-UK. This required in the configuration for the API version to
 * be specified. This device returned data point ids: 1, 2, 3, 4, 6, 7, 17, 20
 *
 * Sample configuration for KJ200G-A3B-UK:
 * {
 *    "name": "Living Room Air Purifier",
 *    "type": "AirPurifier",
 *    "manufacturer": "Elechomes",
 *    "model": "KJ200G-A3B-UK",
 *    "id": "REDACTED",
 *    "key": "REDACTED",
 *    "ip": "192.168.99.50",
 *    "version": "3.3",
 *    "fanSpeedSteps": 3,
 *    "showAirQuality": true
 * }
 *
 *
 */
class AirPurifierAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.AIR_PURIFIER;
    }

    constructor(...props) {
        super(...props);

        const {Characteristic} = this.hap;


        if (!this.device.context.noRotationSpeed) {

            const fanSpeedSteps = (
                this.device.context.fanSpeedSteps &&
                isFinite(this.device.context.fanSpeedSteps) &&
                this.device.context.fanSpeedSteps > 0 &&
                this.device.context.fanSpeedSteps < 100) ? this.device.context.fanSpeedSteps : 100;


            let _fanSpeedLabels = {};

            // Special handling for particular devices //
            switch (this.device.context.manufacturer) {
                case 'Breville':
                    _fanSpeedLabels = {0: 'off', 1: 'low', 2: 'mid', 3: 'high', 4: 'turbo'};
                    this._rotationSteps = [...Array(5).keys()];
                    break;
                default: // Just use numeric values
                    this._rotationSteps = [...Array(fanSpeedSteps).keys()];
                    for (let i = 0; i <= fanSpeedSteps; i++) {
                      _fanSpeedLabels[i] = i;
                    }
            }

            this._rotationStops = {0: _fanSpeedLabels[0]};
            for (let i = 0; i < 100; i++) {
                const _rotationStep = Math.floor(fanSpeedSteps * i / 100);
                this._rotationStops[i+1] = _fanSpeedLabels[_rotationStep];
            }
        }

        this.airQualityLevels = [
            [200, Characteristic.AirQuality.POOR],
            [150, Characteristic.AirQuality.INFERIOR],
            [100, Characteristic.AirQuality.FAIR],
            [50, Characteristic.AirQuality.GOOD],
            [0, Characteristic.AirQuality.EXCELLENT],
        ];

        this.cmdAuto = 'AUTO';
        if (this.device.context.cmdAuto) {
            if (/^a[a-z]+$/i.test(this.device.context.cmdAuto)) this.cmdAuto = ('' + this.device.context.cmdAuto).trim();
            else throw new Error('The cmdAuto doesn\'t appear to be valid: ' + this.device.context.cmdAuto);
        }

    }

    /**
     * Register the services that this accessory supports.
     */
    _registerPlatformAccessory() {
        const {Service} = this.hap;

        /* Add the main air purifier */
        this.accessory.addService(Service.AirPurifier, this.device.context.name);

        /* If configured to include air quality data, include that service too */
        if (this.device.context.showAirQuality) {
            this._addAirQualityService();
        }

        super._registerPlatformAccessory();
    }

    /**
     * Method to add the AirQualitySensor service to the accessory.
     *
     * This is seperate as it may be called after the initial _registerPlatformAccessory call,
     * if the configuration is updated after the device is first added.
     */
    _addAirQualityService() {
        const {Service} = this.hap;

        const nameAirQuality = this.device.context.nameAirQuality || 'Air Quality';
        this.log.info('Adding air quality sensor: %s', nameAirQuality);
        this.accessory.addService(Service.AirQualitySensor, nameAirQuality);
    }

    /**
     * Register the Characteristics that this accessory supports.
     * @param {*} dps
     */
    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;

        /* Air purifier service characteristics */
        const airPurifierService = this.accessory.getService(Service.AirPurifier);
        this._checkServiceName(airPurifierService, this.device.context.name);

        this.log.debug('_registerCharacteristics dps: %o', dps);

        const characteristicActive = airPurifierService.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps[DP_SWITCH]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        const characteristicCurrentAirPurifierState = airPurifierService.getCharacteristic(Characteristic.CurrentAirPurifierState)
            .updateValue(this._getCurrentAirPurifierState(dps[DP_SWITCH]))
            .on('get', this.getCurrentAirPurifierState.bind(this));


        const characteristicTargetAirPurifierState = airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState)
            .updateValue(this._getTargetAirPurifierState(dps[DP_MODE]))
            .on('get', this.getTargetAirPurifierState.bind(this))
            .on('set', this.setTargetAirPurifierState.bind(this));

        let characteristicLockPhysicalControls;
        if (!this.device.context.noChildLock) {
            characteristicLockPhysicalControls = airPurifierService.getCharacteristic(Characteristic.LockPhysicalControls)
                .updateValue(this._getLockPhysicalControls(dps[DP_LOCK_PHYSICAL_CONTROLS]))
                .on('get', this.getLockPhysicalControls.bind(this))
                .on('set', this.setLockPhysicalControls.bind(this));
        } else {
            this._removeCharacteristic(service, Characteristic.LockPhysicalControls);
        }

        const characteristicRotationSpeed = airPurifierService.getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(this._getRotationSpeed(dps))
            .on('get', this.getRotationSpeed.bind(this))
            .on('set', this.setRotationSpeed.bind(this));

        /* Air quality sensor characteristics */
        let airQualitySensorService = this.accessory.getService(Service.AirQualitySensor);
        let characteristicAirQuality;
        let characteristicPM25Density;

        /* Ensure the air quality sensor service existance aligns with the configuration.
         * If configured to include air quality data, and the service was not already registered, register it.
         * If configured to not include it, but the service this there, remove it
         */
        if (!airQualitySensorService && this.device.context.showAirQuality) {
            this._addAirQualityService();
            airQualitySensorService = this.accessory.getService(Service.AirQualitySensor);
        } else if (airQualitySensorService && !this.device.context.showAirQuality) {
            this.accessory.removeService(airQualitySensorService);
        }

        if (airQualitySensorService) {
            const nameAirQuality = this.device.context.nameAirQuality || 'Air Quality';
            this._checkServiceName(airQualitySensorService, nameAirQuality);

            characteristicAirQuality = airQualitySensorService.getCharacteristic(Characteristic.AirQuality)
                .updateValue(this._getAirQuality(dps))
                .on('get', this.getAirQuality.bind(this));

            characteristicPM25Density = airQualitySensorService.getCharacteristic(Characteristic.PM2_5Density)
                .updateValue(dps[DP_PM25])
                .on('get', this.getPM25.bind(this));
        }

        /* Listen for changes */
        this.device.on('change', (changes, state) => {

            this.log.debug('Changes: %o, State: %o', changes, state);

            if (changes.hasOwnProperty(DP_SWITCH)) {
                /* On/Off state change */
                const newActive = this._getActive(changes[DP_SWITCH]);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);

                    characteristicCurrentAirPurifierState.updateValue(
                        this._getCurrentAirPurifierState(changes[DP_SWITCH]));

                    if (!changes.hasOwnProperty(DP_FAN_SPEED)) {
                        characteristicRotationSpeed.updateValue(this._getRotationSpeed(state));
                    }
                    if (!changes.hasOwnProperty(DP_MODE)) {
                        characteristicTargetAirPurifierState.updateValue(
                            this._getTargetAirPurifierState(state[DP_MODE]));
                    }
                }
            }

            if (changes.hasOwnProperty(DP_FAN_SPEED)) {
                /* Fan speed change */
                const newRotationSpeed = this._getRotationSpeed(state);
                if (characteristicRotationSpeed.value !== newRotationSpeed) {
                    characteristicRotationSpeed.updateValue(newRotationSpeed);
                }

                if (!changes.hasOwnProperty(DP_MODE)) {
                    characteristicTargetAirPurifierState.updateValue(
                        this._getTargetAirPurifierState(state[DP_MODE]));
                }
            }

            if (characteristicLockPhysicalControls && changes.hasOwnProperty(DP_LOCK_PHYSICAL_CONTROLS)) {
                /* Child Lock change */
                const newLockPhysicalControls = this._getLockPhysicalControls(changes[DP_LOCK_PHYSICAL_CONTROLS]);
                if (characteristicLockPhysicalControls.value !== newLockPhysicalControls) {
                    characteristicLockPhysicalControls.updateValue(newLockPhysicalControls);
                }
            }

            if (changes.hasOwnProperty(DP_MODE)) {
                /* Change to the running mode */

                const newTargetAirPurifierState = this._getTargetAirPurifierState(changes[DP_MODE]);
                if (characteristicTargetAirPurifierState.value !== newTargetAirPurifierState) {
                    characteristicTargetAirPurifierState.updateValue(newTargetAirPurifierState);
                }
            }

            if (airQualitySensorService && changes.hasOwnProperty(DP_PM25)) {
                /* Change to the air quality */
                const newPM25 = changes[DP_PM25];
                if (characteristicPM25Density.value !== newPM25) {
                    characteristicPM25Density.updateValue(newPM25);
                }

                if (!changes.hasOwnProperty(DP_AIR_QUALITY)) {
                    characteristicAirQuality.updateValue(this._getAirQuality(state));
                }
            }
        });
    }

    getActive(callback) {
        this.getState(DP_SWITCH, (err, dp) => {
            if (err) {
                return callback(err);
            }

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
                return this.setState(DP_SWITCH, true, callback);

            case Characteristic.Active.INACTIVE:
                return this.setState(DP_SWITCH, false, callback);
        }

        callback();
    }

    getAirQuality(callback) {
        this.getState([DP_PM25], (err, dps) => {
            if (err) {
                return callback(err);
            }

            callback(null, this._getAirQuality(dps));
        });
    }

    _getAirQuality(dps) {
        const {Characteristic} = this.hap;
        /* TODO: Other DP values can be used for Air Quality */
        switch (this.device.context.manufacturer) {
            case 'Breville':
                if (dps[DP_AIR_QUALITY]) {
                  switch (dps[DP_AIR_QUALITY]) {
                      case 'poor':
                          return Characteristic.AirQuality.POOR
                      case 'good':
                          return Characteristic.AirQuality.GOOD
                      case 'great':
                          return Characteristic.AirQuality.EXCELLENT
                      default:
                          this.log.warn('Unhandled _getAirQuality value: %s', dps[DP_AIR_QUALITY]);
                          return Characteristic.AirQuality.UNKNOWN
                  }
                }
                break;
            default:

              if (dps[DP_PM25]) {

                  /* Loop through the air quality levels until a match is found */
                  for (var item of this.airQualityLevels) {
                      if (dps[DP_PM25] >= item[0]) {
                          return item[1];
                      }
                  }

              }
        }

        /* Default return value if nothing has already returned */
        return 0;

    }

    getCurrentAirPurifierState(callback) {
        this.getState([DP_SWITCH], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getCurrentAirPurifierState(dps));
        });
    }

    _getCurrentAirPurifierState(dp) {
        const {Characteristic} = this.hap;


        /* There isn't really a direct mapping to this from the purifier,
         * so just using as inactive or purifying.
         */

        return dp ? Characteristic.CurrentAirPurifierState.PURIFYING_AIR : Characteristic.CurrentAirPurifierState.INACTIVE;
    }

    getLockPhysicalControls(callback) {
        this.getState(DP_LOCK_PHYSICAL_CONTROLS, (err, dp) => {
            if (err) {
                return callback(err);
            }

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
                return this.setState(DP_LOCK_PHYSICAL_CONTROLS, true, callback);

            case Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED:
                return this.setState(DP_LOCK_PHYSICAL_CONTROLS, false, callback);
        }

        callback();
    }

    getPM25(callback) {
        this.getState([DP_PM25], (err, dps) => {
            if (err) {
                return callback(err);
            }

            callback(null, dps);
        });
    }

    getRotationSpeed(callback) {
        this.getState([DP_SWITCH, DP_FAN_SPEED], (err, dps) => {
            if (err) {
                return callback(err);
            }

            callback(null, this._getRotationSpeed(dps));
        });
    }

    _getRotationSpeed(dps) {
        if (!dps[DP_SWITCH]) {
            return 0;
        } else if (this._hkRotationSpeed) {
            const currntRotationSpeed = this.convertRotationSpeedFromHomeKitToTuya(this._hkRotationSpeed);

            return currntRotationSpeed === dps[DP_FAN_SPEED] ? this._hkRotationSpeed : this._hkRotationSpeed = this.convertRotationSpeedFromTuyaToHomeKit(dps[DP_FAN_SPEED]);
        }

        return this._hkRotationSpeed = this.convertRotationSpeedFromTuyaToHomeKit(dps[DP_FAN_SPEED]);
    }

    setRotationSpeed(value, callback) {
        const {Characteristic} = this.hap;

        if (value === 0) {
            this.setActive(Characteristic.Active.INACTIVE, callback);
        } else {
            this._hkRotationSpeed = value;
            // This code was only sending the first code, not the second...
            //const newState = {DP_SWITCH: true, DP_FAN_SPEED: this.convertRotationSpeedFromHomeKitToTuya(value)};
            //this.log.debug('setRotationSpeed value: %s. State: %s', value, newState);
            //return this.setMultiState(newState, callback);
            return this.setState(DP_FAN_SPEED, this.convertRotationSpeedFromHomeKitToTuya(value), callback);
        }
    }

    getTargetAirPurifierState(callback) {
        this.getState(DP_MODE, (err, dp) => {
            if (err) {
                return callback(err);
            }

            callback(null, this._getTargetAirPurifierState(dp));
        });
    }

    _getTargetAirPurifierState(dp) {
        const {Characteristic} = this.hap;

        switch (dp) {
            case 'manual':
            case 'Manual':
                return Characteristic.TargetAirPurifierState.MANUAL;
            case 'Sleep':
                //TODO: Handle differently than passing through?
            case 'auto':
            case 'Auto':
                return Characteristic.TargetAirPurifierState.AUTO;
            default:
                this.log.warn('Unhandled getTargetAirPurifierState value: %s', dp);
                return STATE_OTHER;
        }
    }

    setTargetAirPurifierState(value, callback) {
        const {Characteristic} = this.hap;
        switch (value) {
            case Characteristic.TargetAirPurifierState.MANUAL:
                if (this.device.context.manufacturer == 'Breville') {
                    return this.setState(DP_MODE, 'manual', callback);
                } else {
                    return this.setState(DP_MODE, 'Manual', callback);
                }

            case Characteristic.TargetAirPurifierState.AUTO:
                if (this.device.context.manufacturer == 'Breville') {
                    return this.setState(DP_MODE, 'auto', callback);
                } else {
                    return this.setState(DP_MODE, 'Auto', callback);
                }
            default:
                //TODO: Can we do anything about Sleep?
                this.log.warn('Unhandled setTargetAirPurifierState value: %s', value);
        }

        callback();
    }

    getKeyByValue(object, value) {
      return Object.keys(object).find(key => object[key] === value);
    }

    convertRotationSpeedFromHomeKitToTuya(value) {
        this.log.debug('convertRotationSpeedFromHomeKitToTuya: %s: %s', value, this._rotationStops[parseInt(value)]);
        return this._rotationStops[parseInt(value)];
    }

    convertRotationSpeedFromTuyaToHomeKit(value) {
        this.log.debug('convertRotationSpeedFromTuyaToHomeKit: %s: %s', value, this.getKeyByValue(this._rotationStops, value));
        return this.device.context.fanSpeedSteps ? '' + this.getKeyByValue(this._rotationStops, value) : this.getKeyByValue(this._rotationStops, value);
    }

}

module.exports = AirPurifierAccessory;
