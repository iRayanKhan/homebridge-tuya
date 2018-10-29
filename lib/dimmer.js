const TuyaDevice = require('tuyapi');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

class DimmerAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    this.platform = platform;
    PlatformAccessory = platform.api.platformAccessory;

    ({ Accessory, Service, Characteristic, uuid: UUIDGen } = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;
    this.deviceConfig.dpsMap = {
      onOff = deviceConfig.dpsOn || 1,
      brightness = deviceConfig.dpsBright || 2
    };

    this.device = new TuyaDevice(deviceConfig);

    if (this.homebridgeAccessory) {
      this.log.debug(
        'Existing Accessory found [%s] [%s] [%s]',
        homebridgeAccessory.displayName,
        homebridgeAccessory.context.deviceId,
        homebridgeAccessory.UUID
      );
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      this.log.debug('Creating new Accessory %s', this.deviceConfig.id);
      this.homebridgeAccessory = new PlatformAccessory(
        this.deviceConfig.name,
        UUIDGen.generate(this.deviceConfig.id + this.deviceConfig.name),
        Accessory.Categories.LIGHTBULB
      );
      platform.registerPlatformAccessory(this.homebridgeAccessory);
    }

    this.dimmerService = this.homebridgeAccessory.getService(Service.Lightbulb);
    if (this.dimmerService) {
      this.dimmerService.setCharacteristic(Characteristic.Name, this.deviceConfig.name);
    } else {
      this.log.debug('Creating new Service %s', this.deviceConfig.id);
      this.dimmerService = this.homebridgeAccessory.addService(
        Service.Lightbulb,
        this.deviceConfig.name
      );
    }

    this.dimmerService
      .getCharacteristic(Characteristic.On)
      .on('get', (callback) => {
        this.log.debug('[%s] On get', this.homebridgeAccessory.displayName);

        this.device
          .get({ dps: this.deviceConfig.dpsMap.onOff })
          .then((status) => {
            callback(null, status);
          })
          .catch((error) => {
            callback(error);
          });
      })
      .on('set', (value, callback) => {
        this.log.debug('[%s] On set', this.homebridgeAccessory.displayName);

        this.device
          .set({ set: value, dps: this.deviceConfig.dpsMap.onOff })
          .then(() => {
            callback();
          })
          .catch((error) => {
            callback(error);
          });
      });

    this.dimmerService
      .getCharacteristic(Characteristic.Brightness)
      .on('get', (callback) => {
        this.log.debug('[%s] On get', this.homebridgeAccessory.displayName);

        this.device
          .get({ dps: this.deviceConfig.dpsMap.brightness })
          .then((status) => {
            callback(null, status);
          })
          .catch((error) => {
            callback(error);
          });
      })
      .on('set', (value, callback) => {
        this.log.debug('[%s] On set', this.homebridgeAccessory.displayName);

        this.device
          .set({ set: value, dps: this.deviceConfig.dpsMap.brightness })
          .then(() => {
            callback();
          })
          .catch((error) => {
            callback(error);
          });
      });

    this.homebridgeAccessory.on('identify', (paired, callback) => {
      this.log.debug('[%s] identify', this.homebridgeAccessory.displayName);
      callback();
    });
  }
}

module.exports = DimmerAccessory;
