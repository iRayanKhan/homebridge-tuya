const TuyaDevice = require('tuyapi');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

class GenericAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    this.platform = platform;
    PlatformAccessory = platform.api.platformAccessory;

    ({Accessory, Service, Characteristic, uuid: UUIDGen} = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;

    this.device = new TuyaDevice(deviceConfig);

    if (this.homebridgeAccessory) {
      this.log.debug('Existing Accessory found [%s] [%s] [%s]', homebridgeAccessory.displayName, homebridgeAccessory.context.deviceId, homebridgeAccessory.UUID);
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      this.log.debug('Creating new Accessory %s', this.deviceConfig.id);
      this.homebridgeAccessory = new PlatformAccessory(this.deviceConfig.name, UUIDGen.generate(this.deviceConfig.id), Accessory.Categories.OUTLET);
      platform.registerPlatformAccessory(this.homebridgeAccessory);
    }

    this.outletService = this.homebridgeAccessory.getService(Service.Outlet);
    if (this.outletService) {
      this.outletService.setCharacteristic(Characteristic.Name, this.deviceConfig.name);
    } else {
      this.log.debug('Creating new Service %s', this.deviceConfig.id);
      this.outletService = this.homebridgeAccessory.addService(Service.Outlet, this.deviceConfig.name);
    }

    this.outletService.getCharacteristic(Characteristic.On)
      .on('get', callback => {
        this.log.debug('[%s] On get', this.homebridgeAccessory.displayName);

        this.device.get({dps: this.deviceConfig.dps}).then(status => {
          callback(null, status);
        }).catch(error => {
          callback(error);
        });
      })
      .on('set', (value, callback) => {
        this.log.debug('[%s] On set', this.homebridgeAccessory.displayName);

        this.device.set({set: value, dps: this.deviceConfig.dps}).then(() => {
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

  get plug() {
    return this._plug;
  }

  set plug(plug) {
    this._plug = plug;
  }
}

module.exports = GenericAccessory;
