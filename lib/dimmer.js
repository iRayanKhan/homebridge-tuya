const TuyaDevice = require('tuyapi');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

// Base on a 5-stage dimmer switch
const vals = [0, 20, 40, 60, 80, 100];

function closest(num) {
  const arr = vals;
  var curr = arr[0];
  var diff = Math.abs(num - curr);
  for (var val = 0; val < arr.length; val++) {
    var newdiff = Math.abs(num - arr[val]);
    if (newdiff < diff) {
      diff = newdiff;
      curr = arr[val];
    }
  }
  return curr;
}

class DimmerAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    this.platform = platform;
    PlatformAccessory = platform.api.platformAccessory;

    ({ Accessory, Service, Characteristic, uuid: UUIDGen } = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;
    this.deviceConfig.dpsMap = {
      onOff: deviceConfig.dpsOn || 1,
      brightness: deviceConfig.dpsBright || 2,
    };
    this.dimmerTimeout = null;
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
          .get({ dps: this.deviceConfig.dpsMap.onOff })
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
          .set({ set: value, dps: this.deviceConfig.dpsMap.onOff })
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
          .get({ dps: this.deviceConfig.dpsMap.brightness })
          .then((status) => {
            const val = closest(Math.ceil(100 / (255 / status)));
            callback(null, val);
          })
          .catch((error) => {
            this.log.error(error);
            callback(error);
          });
      })
      .on('set', (value, callback) => {
        if (this.dimmerTimeout) {
          clearTimeout(this.dimmerTimeout);
        }
        this.dimmerTimeout = setTimeout(
          function(self, value, callback) {
            const pct = closest(value);
            const val = Math.floor(255 * (pct / 100));
            self.log.info('[%s] On set brightness %s', self.homebridgeAccessory.displayName, val);

            self.device
              .set({ set: val, dps: self.deviceConfig.dpsMap.brightness })
              /* .then(() => {
                callback();
              }) */
              .catch((error) => {
                self.log.error(error);
                callback(error);
              });
            self.dimmerTimeout = null;
          },
          this.deviceConfig.delay || 1250,
          this,
          value,
          callback
        );
        callback();
      });

    this.homebridgeAccessory.on('identify', (paired, callback) => {
      this.log.debug('[%s] identify', this.homebridgeAccessory.displayName);
      callback();
    });
  }
}

module.exports = DimmerAccessory;
