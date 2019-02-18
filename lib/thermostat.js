const TuyaDevice = require('tuyapi');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

class ThermostatAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    this.platform = platform;
    PlatformAccessory = platform.api.platformAccessory;

    ({Accessory, Service, Characteristic, uuid: UUIDGen} = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;

    this.deviceConfig.options = this.deviceConfig.options || {};

    this.device = new TuyaDevice(deviceConfig);

    // Add accessories if neccessary, otherwise use cache

    // Main set temperature accessory
    const accessoryUUID = UUIDGen.generate(this.deviceConfig.id + this.deviceConfig.name);

    if (this.homebridgeAccessory) {
      this.log.debug('Existing Accessory found [%s] [%s] [%s]', homebridgeAccessory.displayName, homebridgeAccessory.context.deviceId, homebridgeAccessory.UUID);
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      this.log.debug('Creating new Accessory %s', this.deviceConfig.id);
      this.homebridgeAccessory = new PlatformAccessory(this.deviceConfig.name, accessoryUUID, Service.Thermostat);
      platform.registerPlatformAccessory(this.homebridgeAccessory);
    }

    this.service = this.homebridgeAccessory.getService(Service.Thermostat);

    if (this.service) {
      this.service.setCharacteristic(Characteristic.Name, this.deviceConfig.name);
    } else {
      this.log.debug('Creating a new Service %s', this.deviceConfig.id);
      this.service = this.homebridgeAccessory.addService(Service.Thermostat, this.deviceConfig.name);
    }

    // Add event handlers
    this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', callback => {
        this.log.debug('Getting current temperature...');

        this.device.get({dps: '3'}).then(tempC => {
          callback(null, tempC / 10);
        }).catch(error => {
          callback(error);
        });
      });

    this.service.getCharacteristic(Characteristic.TargetTemperature)
      .on('get', callback => {
        this.log.debug('Getting target temperature...');

        this.device.get({dps: '2'}).then(tempC => {
          callback(null, tempC / 10);
        }).catch(error => {
          callback(error);
        });
      })
      .on('set', (value, callback) => {
        this.log.debug('Setting target temperature...');

        this.device.set({data: {2: value * 10, 4: 'manual'}, multiple: true}).then(() => {
          callback();
        }).catch(error => {
          callback(error);
        });
      });

    this.homebridgeAccessory.on('identify', (paired, callback) => {
      this.log.debug('[%s] identify', this.homebridgeAccessory.displayName);
      callback();
    });
  }
}

module.exports = ThermostatAccessory;
