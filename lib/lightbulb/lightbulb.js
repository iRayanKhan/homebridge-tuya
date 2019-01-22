/*
  Support for Tuya Lightbulb.
  The API documentation can be found here https://docs.tuya.com/en/openapi/standardFunction/dj_standard_functions.html
  Although the docs do not directly correspond to the values we really
  operate with, the concept remains the same, and it allows to see the options,
  including data ranges.

  @author Iurii Zisin [https://github.com/zysoft]
  Derived from Max Isom [https://github.com/codetheweb] work on dimmer accessory.
*/

const TuyaDevice = require('tuyapi');

const {ValueRange, LightbulbState, OperationMode} = require('./helpers');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

// Set of defined ranges with the defaults
// The defaults are taken from:
// HAP: https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js
// Tuya: https://docs.tuya.com/en/openapi/standardFunction/dj_standard_functions.html

const ranges = {
  TuyaBrightnessRange: new ValueRange(25, 255),
  HomeKitBrightnessRange: new ValueRange(0, 100),
  TuyaColorTemperatureRange: new ValueRange(0, 255),
  HomeKitColorTemperatureRange: new ValueRange(140, 500),
  TuyaSaturationRange: new ValueRange(0, 255),
  TuyaLightnessRange: new ValueRange(0, 255)
};

// The corresponding HomeKit range for TuyaLightnessRange is HomeKitBrightnessRange

/*
  Map for the device settings.
  Defaults are based on API docs and should match the most bulbs.
*/
const DpsMap = {
  onOff: 1,
  opMode: 2,
  brightness: 3,
  colorTemperature: 4,
  color: 5
};

class LightbulbAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    this.platform = platform;
    PlatformAccessory = platform.api.platformAccessory;

    ({Accessory, Service, Characteristic, uuid: UUIDGen} = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;
    this.deviceConfig.persistentConnection = true;

    this.deviceConfig.options = this.deviceConfig.options || {};

    // The DpsMap is fully configurable using the "options" section

    if ('dpsOn' in this.deviceConfig.options) {
      DpsMap.onOff = this.deviceConfig.options.dpsOn;
    }
    if ('dpsOpMode' in this.deviceConfig.options) {
      DpsMap.opMode = this.deviceConfig.options.dpsOpMode;
    }
    if ('dpsBright' in this.deviceConfig.options) {
      DpsMap.brightness = this.deviceConfig.options.dpsBright;
    }
    if ('dpsColortemp' in this.deviceConfig.options) {
      DpsMap.colorTemperature = this.deviceConfig.options.dpsColortemp;
    }
    if ('dpsColor' in this.deviceConfig.options) {
      DpsMap.color = this.deviceConfig.options.dpsColor;
    }

    // The "options" section allows to also configure the data ranges for Tuya values
    // The defaults are configured according to API docs and should match the most bulbs.

    if ('brighnessMin' in this.deviceConfig.options) {
      ranges.TuyaBrightnessRange.minValue = this.deviceConfig.options.brighnessMin;
    }
    if ('brighnessMax' in this.deviceConfig.options) {
      ranges.TuyaBrightnessRange.maxValue = this.deviceConfig.options.brighnessMax;
    }

    if ('colorTempMin' in this.deviceConfig.options) {
      ranges.TuyaColorTemperatureRange.minValue = this.deviceConfig.options.colorTempMin;
    }
    if ('colorTempMax' in this.deviceConfig.options) {
      ranges.TuyaColorTemperatureRange.maxValue = this.deviceConfig.options.colorTempMax;
    }

    if ('saturationMin' in this.deviceConfig.options) {
      ranges.TuyaSaturationRange.minValue = this.deviceConfig.options.saturationMin;
    }
    if ('saturationMax' in this.deviceConfig.options) {
      ranges.TuyaSaturationRange.maxValue = this.deviceConfig.options.saturationMax;
    }

    if ('lightnessMin' in this.deviceConfig.options) {
      ranges.TuyaLightnessRange.minValue = this.deviceConfig.options.lightnessMin;
    }
    if ('lightnessMax' in this.deviceConfig.options) {
      ranges.TuyaLightnessRange.maxValue = this.deviceConfig.options.lightnessMax;
    }

    // "featuers" is the section in config where supprted lightbulb modes are listed
    // By default the bulb will only turn on and off and will have no conrols.
    // All supprted modes should be listed in an arry,
    // for example:
    // ...
    // "features": ["dimmable", "colortemp"]
    // ...
    if ('features' in this.deviceConfig) {
      this.features = {
        dimmable: this.deviceConfig.features.indexOf('dimmable') !== -1,
        colortemp: this.deviceConfig.features.indexOf('colortemp') !== -1,
        rgb: this.deviceConfig.features.indexOf('rgb') !== -1
      };
    }
    this.features = this.features || {};

    // Current state where all changes accumulate
    this.currentState = new LightbulbState(DpsMap, ranges, Characteristic);
    // The "old" state which carries the state of the last applied settings
    this.oldState = this.currentState.copy();

    this.device = new TuyaDevice(deviceConfig);
    this.device.connect();

    this.device.on('data', (data, command) => {
      if (data === undefined) {
        this.log.debug('No data');
      } else {
        this.log.debug('Updating', this.homebridgeAccessory.displayName, data, command);
        // When applying changes from the DPS list, all found
        // mapped DPS will be applied and the set of HomeKit characteristics
        // to update will be returned.
        // The updates are array of objects like { set: characterstic, value: xxx}
        const updates = this.currentState.updateFromDps(data.dps);
        // Since this is an update from Tuya device, this is it's current state,
        // so we make oldState shoud match currentState in order to make sure
        // we keep making changes based on the actual lightbulb state.
        this.oldState = this.currentState.copy();

        // We go through all the updates returned and apply them
        for (const i in updates) {
          if (Object.prototype.hasOwnProperty.call(updates, i)) {
            const update = updates[i];
            this.homebridgeAccessory.getService(Service.Lightbulb)
              .getCharacteristic(update.set)
              .updateValue(update.value);
          }
        }
      }
    }
    );

    this.device.on('error', () => {
      this.log.debug('ERROR: not responding', this.homebridgeAccessory.displayName);
      this.homebridgeAccessory
        .getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.On)
        .updateValue(new Error('Not Responding'));
    }
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

    this.lightbulbService = this.homebridgeAccessory.getService(Service.Lightbulb);
    if (this.lightbulbService) {
      this.lightbulbService.setCharacteristic(Characteristic.Name, this.deviceConfig.name);
    } else {
      this.log.debug('Creating new Service %s', this.deviceConfig.id);
      this.lightbulbService = this.homebridgeAccessory.addService(
        Service.Lightbulb,
        this.deviceConfig.name
      );
    }

    this.lightbulbService
      .getCharacteristic(Characteristic.On)
      .on('set', (value, callback) => {
        this.currentState.isOn = value;
        // Schedule the changes
        this.scheduleChange(callback);
      });

    if (this.features.dimmable) {
      const brightness = this.lightbulbService.getCharacteristic(Characteristic.Brightness);

      // We update HomeKitBrightnessRange to match the actual values
      ranges.HomeKitBrightnessRange.minValue = brightness.props.minValue;
      ranges.HomeKitBrightnessRange.maxValue = brightness.props.maxValue;

      brightness.on('set', (value, callback) => {
        this.log.debug('[%s] On set brightness', this.homebridgeAccessory.displayName);
        this.currentState.isOn = value > ranges.HomeKitBrightnessRange.minValue;
        if (this.currentState.isOn) {
          if (this.currentState.opMode === OperationMode.white) {
            this.currentState.brightness.set(value, ranges.HomeKitBrightnessRange);
          } else if (this.currentState.opMode === OperationMode.color) {
            this.currentState.color.V = value;
          }
        }
        // Schedule the changes
        this.scheduleChange(callback);
      });
    }

    if (this.features.colortemp) {
      const colorTemperature = this.lightbulbService.getCharacteristic(Characteristic.ColorTemperature);

      // We update HomeKitColorTemperatureRange to match the actual values
      ranges.HomeKitColorTemperatureRange.minValue = colorTemperature.props.minValue;
      ranges.HomeKitColorTemperatureRange.maxValue = colorTemperature.props.maxValue;

      colorTemperature.on('set', (value, callback) => {
        this.log.debug('[%s] On set color temperature', this.homebridgeAccessory.displayName);
        this.currentState.colorTemperature.set(value, ranges.HomeKitColorTemperatureRange, true);
        // Schedule the changes
        this.scheduleChange(callback);
      });
    }

    if (this.features.rgb) {
      this.lightbulbService
        .getCharacteristic(Characteristic.Hue)
        .on('set', (value, callback) => {
          this.log.debug('[%s] On set color hue', this.homebridgeAccessory.displayName);
          // The color data is stored in HomeKit values
          this.currentState.color.H = value;
          // In color mode, the brightness deifnes the color Value component.
          // We set it here to make sure it is correctly applied
          this.currentState.color.V = this.currentState.brightness.to(ranges.HomeKitBrightnessRange);
          // Schedule the changes
          this.scheduleChange(callback);
        });

      this.lightbulbService
        .getCharacteristic(Characteristic.Saturation)
        .on('set', (value, callback) => {
          this.log.debug('[%s] On set color hue', this.homebridgeAccessory.displayName);
          // The color data is stored in HomeKit values
          this.currentState.color.S = value;
          // In color mode, the brightness deifnes the color Value component.
          // We set it here to make sure it is correctly applied
          this.currentState.color.V = this.currentState.brightness.to(ranges.HomeKitBrightnessRange);
          // Schedule the changes
          this.scheduleChange(callback);
        });
    }

    this.homebridgeAccessory.on('identify', (paired, callback) => {
      this.log.debug('[%s] identify', this.homebridgeAccessory.displayName);
      callback();
    });
  }

  /*
    Schedules the changes to be sent to Tuya device.
    This significantly improves the feedback time by reducing traffic sent to
    a Tuya device when characteristics rapidly change. The best example is color,
    where HomeKit sends use values for Hue and Saturation almost instantaneously.
    Since both values define a single color, there is no need to send two commands.
    Instead, this method keeps postponing the updates until all rapid changes are
    performed.
    The callback is stored in updateCallback property and it will be executed
    in case another change is performed rapidly causing another timeout.
    This way we don't hold HomeKit down waiting for processing.
    Introducing this methods significantly reduced the lag when communicating
    to the device, and allowed to see the changes almost instantaneously as
    you drag the color selector or brightness switch.
  */
  scheduleChange(callback) {
    clearTimeout(this.updateTimer);
    if (typeof (this.updateCallback) === 'function') {
      this.updateCallback();
    }
    this.updateCallback = callback;
    this.updateTimer = setTimeout(() => {
      const commands = this.oldState.commandsToMatch(this.currentState);
      this.oldState = this.currentState.copy();
      this.device.setMany(commands, this.updateCallback);
      this.updateCallback = null;
    }, 100);
  }
}

module.exports = LightbulbAccessory;

/** ****** Helper Classes ********/

/*
  A little extension to Tuyapi allowing sequential execution of a set of commands.
  This is needed in order to simplify the state updates.
  The supplied chain of commands is executed sequentially until no commands
  are left, then the callback is called if any.
  This allows setting, for example, color temperature along with operation mode
  in one call (to apply color temperature, you also have to change the operation
  mode, if the bulb is not in "white" mode).
*/
TuyaDevice.prototype.setMany = function (commands, callback) {
  callback = callback || function () {};
  if (commands.length <= 0) {
    callback();
    return;
  }

  const command = commands.shift();
  this.set(command).then(() => {
    this.setMany(commands, callback);
  }).catch(error => {
    callback(error);
  });
};
