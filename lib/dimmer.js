const TuyaDevice = require('tuyapi');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

const oldOptKeys = ['dpsOn', 'dpsBright', 'minVal', 'maxVal', 'dpsMinBright'];
function checkDimmerOptionsUpgrade(deviceConfig, log) {
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
    this.deviceConfig.persistentConnection = true;

    checkDimmerOptionsUpgrade(this.deviceConfig, this.log);

    this.deviceConfig.options = this.deviceConfig.options || {};

    this.dpsMap = {
      onOff: ('dpsOn' in this.deviceConfig.options) ? this.deviceConfig.options.dpsOn : 1,
      brightness: ('dpsBright' in this.deviceConfig.options) ? this.deviceConfig.options.dpsBright : 2,
      minBrightness: ('dpsMinBright' in this.deviceConfig.options) ? this.deviceConfig.options.dpsMinBright : 3,
    };
    this.minVal = ('minVal' in this.deviceConfig.options) ? this.deviceConfig.options.minVal : 11;
    this.maxVal = ('maxVal' in this.deviceConfig.options) ? this.deviceConfig.options.maxVal : 244;

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
          for (var index in data.dps) {
            switch (parseInt(index)) {
              case this.dpsMap.onOff:
                this.homebridgeAccessory
                  .getService(Service.Lightbulb)
                  .getCharacteristic(Characteristic.On)
                  .updateValue(data.dps[index]);
                break;
              case this.dpsMap.brightness:
                this.homebridgeAccessory
                  .getService(Service.Lightbulb)
                  .getCharacteristic(Characteristic.Brightness)
                  .updateValue(Math.floor((data.dps[index] / this.maxVal) * 100));
                break;
              case this.dpsMap.minBrightness:
                this.minVal = data.dps[index];
                break;
              default:
                this.log.error('Unmapped dps data', index, data.dps[index]);
            }
          }
        } else {
          this.log.debug('No data');
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

    this.dimmerService.getCharacteristic(Characteristic.On)
      .on('set', (value, callback) => {
        this.log.debug('[SET][%s] On set %s', this.homebridgeAccessory.displayName, value);

        this.device
          .set({ set: value, dps: this.dpsMap.onOff })
          .then(() => {
            callback();
          })
          .catch(error => {
            this.log.error(error);
            callback(error);
          });
      });

    this.dimmerService.getCharacteristic(Characteristic.Brightness)
      .on('set', (percent, callback) => {
        // Reason why calling callback() directly after receiving request
        // Fix for HomeKit reporting this accessory as offline when changing brightness
        // due to the fast repeating 'set' events Homebrigde is not always fast enough
        // in reporting back. 
        //
        // Info from HAP-NodeJS 'Light_accessory.js:99':
        //    Our light is synchronous - this value has been successfully set
        //    Invoke the callback when you finished processing the request
        //    If it's going to take more than 1s to finish the request, try to invoke the callback
        //    after getting the request instead of after finishing it. This avoids blocking other
        //    requests from HomeKit.
        callback();

        var value = Math.ceil((percent * this.maxVal) / 100);
        if (value < this.minVal) {
          value = this.minVal;
        }

        this.device
          .set({ set: value, dps: this.dpsMap.brightness })
          .then(() => {
            this.log.debug(
              '[SET][%s] On set brightness percent %s (value %s)', 
              this.homebridgeAccessory.displayName, percent, value);
          })
          .catch(error => {
            this.log.error(error);
            this.log.debug(
              '[SET][%s] On set brightness percent %s (value %s)', 
              this.homebridgeAccessory.displayName, percent, error);
          });
      });

    this.homebridgeAccessory.on('identify', (paired, callback) => {
      this.log.debug('[%s] identify', this.homebridgeAccessory.displayName);
      callback();
    });
  }
}

module.exports = {
  DimmerAccessory,
  checkDimmerOptionsUpgrade,
};
