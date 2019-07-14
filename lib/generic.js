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

    ({ Accessory, Service, Characteristic, uuid: UUIDGen } = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;

    if (this.deviceConfig.dps) {
      this.log.warn("Looks like you're using an old config format. Please check the README for an updated example.");
    }
    this.deviceConfig.options = this.deviceConfig.options || {};

    if ('dps' in this.deviceConfig.options) {
      this.dps = this.deviceConfig.options.dps;
    } else if ('dps' in this.deviceConfig) {
      this.dps = this.deviceConfig.dps;
    } else {
      this.dps = '1';
    }

    this.device = new TuyaDevice(deviceConfig);

    this.device.find().then(() => {
      this.log.debug('Attempting to connect to %s', this.homebridgeAccessory.displayName);
      // Connect to device
      this.device.connect();
      this.log.debug('Successful Connection');
    });

    this.device.on(
      'data',
      function (data, command) {
        if (data !== undefined) {
          this.log.debug('[UPDATING][%s] (cmd %s):', this.homebridgeAccessory.displayName, command, data);
        }
      }.bind(this)
    );

    this.device.on(
      'error',
      function (err) {
        this.log.error('ERROR: not responding', this.homebridgeAccessory.displayName, err);
      }.bind(this)
    );

    if (this.homebridgeAccessory) {
      if (!this.homebridgeAccessory.context.deviceId) {
        this.homebridgeAccessory.context.deviceId = this.deviceConfig.id;
      }
      this.log.info('Existing Accessory found [%s] [%s] [%s]', homebridgeAccessory.displayName, homebridgeAccessory.context.deviceId, homebridgeAccessory.UUID);
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      this.log.info('Creating new Accessory %s', this.deviceConfig.id);
      this.homebridgeAccessory = new PlatformAccessory(this.deviceConfig.name, UUIDGen.generate(this.deviceConfig.id + this.deviceConfig.name), Accessory.Categories.OUTLET);
      this.homebridgeAccessory.context.deviceId = this.deviceConfig.id;
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
        this.device.get({ dps: this.dps }).then(status => {
          callback(null, status);
          this.log.debug('[GET][%s]: %s', this.homebridgeAccessory.displayName, status);
        }).catch(error => {
          callback(error);
          this.log.debug('[GET][%s] %s', this.homebridgeAccessory.displayName, error);
        });
      })
      .on('set', (value, callback) => {
        this.device.set({ set: value, dps: this.dps }).then(() => {
          callback();
          this.log.debug('[SET][%s]: %s', this.homebridgeAccessory.displayName, value);
        }).catch(error => {
          callback(error);
          this.log.debug('[SET][%s] %s', this.homebridgeAccessory.displayName, error);
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
