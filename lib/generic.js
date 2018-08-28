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

    ({
      Accessory,
      Service,
      Characteristic,
      uuid: UUIDGen
    } = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;

    this.device = new TuyaDevice(deviceConfig);

    if (this.homebridgeAccessory) {
      this.log.debug('Existing Accessory found [%s] [%s] [%s]', homebridgeAccessory.displayName, homebridgeAccessory.context.deviceId, homebridgeAccessory.UUID);
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      this.log.debug('Creating new Accessory %s', this.deviceConfig.name);

      this.homebridgeAccessory = new PlatformAccessory(this.deviceConfig.name, UUIDGen.generate(this.deviceConfig.id + this.deviceConfig.name));
      this.homebridgeAccessory.context.deviceConfig = this.deviceConfig;
      this.homebridgeAccessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "TUYA")
        .setCharacteristic(Characteristic.Model, this.deviceConfig.productKey)
        .setCharacteristic(Characteristic.SerialNumber, this.deviceConfig.id);
      //TODO
      //.setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version);

      switch (this.deviceConfig.productKey) {
        case "DsS0exXElZJSWIdc":
          // WiFi Dimmer
          this.log.debug('Adding lightbulb');
          this.homebridgeAccessory.addService(Service.Lightbulb, this.deviceConfig.name)
            .addCharacteristic(Characteristic.Brightness);
          break;
        default:
          this.log.error('Unknown Product Key, defaulting to outlet', this.deviceConfig);
          this.homebridgeAccessory.addService(Service.Outlet, this.deviceConfig.name);
      }
      platform.registerPlatformAccessory(this.homebridgeAccessory);
    }
    this.homebridgeAccessory.on('identify', (paired, callback) => {
      this.log.debug('[%s] identify', this.homebridgeAccessory.displayName);
      callback();
    });

    switch (this.deviceConfig.productKey) {
      case "DsS0exXElZJSWIdc":
        // WiFi Dimmer
        this.log.debug('Configuring lightbulb');
        this.homebridgeAccessory.getService(Service.Lightbulb)
          .getCharacteristic(Characteristic.On)
          .on('get', callback => {
            this.log.debug('[%s] On get', this.homebridgeAccessory.displayName);

            //tuya.get({schema: true}).then(data => console.log(data))

            this.device.get({
              dps: this.deviceConfig.dps,
              schema: true
            }).then(status => {
              this.log.debug("Scheme", status,status,status.dps[3]);
              callback(null, status.dps[1]);
            }).catch(error => {
              callback(error);
            });
          })
          .on('set', (value, callback) => {
            this.log.debug('[%s] On set', this.homebridgeAccessory.displayName);

            this.device.set({
              set: value,
              dps: 1
            }).then(() => {
              callback();
            }).catch(error => {
              callback(error);
            });
          });
          this.homebridgeAccessory.getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Brightness)
            .on('get', callback => {
              this.log.debug('[%s] On get', this.homebridgeAccessory.displayName);

              //tuya.get({schema: true}).then(data => console.log(data))

              this.device.get({
                dps: this.deviceConfig.dps,
                schema: true
              }).then(status => {
                this.log.debug("Scheme", status,status.dps[3]);
                callback(null, status.dps[3]);
              }).catch(error => {
                callback(error);
              });
            })
            .on('set', (value, callback) => {
              this.log.debug('[%s] Brightness set', this.homebridgeAccessory.displayName);

              this.device.set({
                set: value,
                dps: 3
              }).then(() => {
                callback();
              }).catch(error => {
                callback(error);
              });
            });
        this.log.debug("Configured");
        break;
      default:
        this.log.error('Unknown Product Key, defaulting to outlet', this.deviceConfig);
        this.homebridgeAccessory.getService(Service.Outlet)
          .getCharacteristic(Characteristic.On)
          .on('get', callback => {
            this.log.debug('[%s] On get', this.homebridgeAccessory.displayName);

            //tuya.get({schema: true}).then(data => console.log(data))

            this.device.get({
              dps: this.deviceConfig.dps,
              schema: true
            }).then(status => {
              this.log.debug("Scheme", status);
              callback(null, status);
            }).catch(error => {
              callback(error);
            });
          })
          .on('set', (value, callback) => {
            this.log.debug('[%s] On set', this.homebridgeAccessory.displayName);

            this.device.set({
              set: value,
              dps: this.deviceConfig.dps
            }).then(() => {
              callback();
            }).catch(error => {
              callback(error);
            });
          });
    }
  }

  get plug() {
    return this._plug;
  }

  set plug(plug) {
    this._plug = plug;
  }
}

module.exports = GenericAccessory;
