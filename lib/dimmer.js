const TuyaDevice = require('tuyapi');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

const oldOptKeys = ['dpsOn', 'dpsBright', 'minVal', 'maxVal'];
function checkOptionsUpgrade(deviceConfig, log) {
  const upgOpts = Object.keys(deviceConfig).filter((k) => oldOptKeys.includes(k));
  if (upgOpts && upgOpts.length > 0) {
    log.warn(`Please follow the examples in the readme to upgrade these options: ${upgOpts}`);
  }
}

class DimmerAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    this.platform = platform;
    PlatformAccessory = platform.api.platformAccessory;

    ({ Accessory, Service, Characteristic, uuid: UUIDGen } = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;

    checkOptionsUpgrade(this.deviceConfig, this.log);

    this.deviceConfig.options = this.deviceConfig.options || {};
    this.dpsMap = {
      onOff: this.deviceConfig.options.dpsOn || 1,
      brightness: this.deviceConfig.options.dpsBright || 2,
    };
    this.minVal = this.deviceConfig.options.minVal || 11;
    this.maxVal = this.deviceConfig.options.maxVal || 244;
    this.device = new TuyaDevice(deviceConfig);

    if (this.homebridgeAccessory) {
      if (!this.homebridgeAccessory.context.deviceId)
        this.homebridgeAccessory.context.deviceId = this.deviceConfig.id;

      this.log.info(
        'Existing Accessory found [%s] [%s] [%s]',
        homebridgeAccessory.displayName,
        homebridgeAccessory.context.deviceId,
        homebridgeAccessory.UUID
      );
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      this.log.info('Creating new Accessory %s', this.deviceConfig.id);
      this.homebridgeAccessory = new PlatformAccessory(
        this.deviceConfig.name,
        UUIDGen.generate(this.deviceConfig.id + this.deviceConfig.name),
        Accessory.Categories.LIGHTBULB
      );
      this.homebridgeAccessory.context.deviceId = this.deviceConfig.id;
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
          .get({ dps: this.dpsMap.onOff })
          .then((status) => {
            callback(null, status);
          })
          .catch((error) => {
            this.log.error(error);
            callback(error);
          });
      })
      .on('set', (value, callback) => {
        this.log.debug('[%s] On set %s', this.homebridgeAccessory.displayName, value);

        this.device
          .set({ set: value, dps: this.dpsMap.onOff })
          .then(() => {
            callback();
          })
          .catch((error) => {
            this.log.error(error);
            callback(error);
          });
      });

    this.dimmerService
      .getCharacteristic(Characteristic.Brightness)
      .on('get', (callback) => {
        this.log.debug('[%s] On get brightness', this.homebridgeAccessory.displayName);

        this.device
          .get({ dps: this.dpsMap.brightness })
          .then((value) => {
            const percent = Math.floor(((value - this.minVal) / this.maxVal) * 100);
            this.log.debug(
              '[%s] \tGet brightness %s from %s',
              this.homebridgeAccessory.displayName,
              percent,
              value
            );
            callback(null, percent);
          })
          .catch((error) => {
            this.log.error(error);
            callback(error);
          });
      })
      .on('set', (percent, callback) => {
        this.log.debug('[%s] On set brightness', this.homebridgeAccessory.displayName);

        const value = Math.ceil((percent * this.maxVal) / 100) + this.minVal;
        this.log.debug(
          '[%s] \tSet brightness %s from %s',
          this.homebridgeAccessory.displayName,
          value,
          percent
        );

        this.device
          .set({ set: value, dps: this.dpsMap.brightness })
          .then(() => {
            callback();
          })
          .catch((error) => {
            this.log.error(error);
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
