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
var Convert = require('color-convert');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

/*
  Map for the device settings.
  Defaults are based on API docs and should match the most bulbs.
*/
var DpsMap = {
  onOff: 1,
  opMode: 2,
  brightness: 3,
  colorTemperature: 4,
  color: 5
}

class LightbulbAccessory {
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
    this.deviceConfig.persistentConnection = true;

    this.deviceConfig.options = this.deviceConfig.options || {};

    //The DpsMap is fully configurable using the "options" section

    if ('dpsOn' in this.deviceConfig.options) DpsMap.onOff = this.deviceConfig.options.dpsOn;
    if ('dpsOpMode' in this.deviceConfig.options) DpsMap.opMode = this.deviceConfig.options.dpsOpMode;
    if ('dpsBright' in this.deviceConfig.options) DpsMap.brightness = this.deviceConfig.options.dpsBright;
    if ('dpsColortemp' in this.deviceConfig.options) DpsMap.colorTemperature = this.deviceConfig.options.dpsColortemp;
    if ('dpsColor' in this.deviceConfig.options) DpsMap.color = this.deviceConfig.options.dpsColor;

    //The "options" section allows to also configure the data ranges for Tuya values
    //The defaults are configured according to API docs and should match the most bulbs.

    if ('brighnessMin' in this.deviceConfig.options) TuyaBrightnessRange.minValue = this.deviceConfig.options.brighnessMin;
    if ('brighnessMax' in this.deviceConfig.options) TuyaBrightnessRange.maxValue = this.deviceConfig.options.brighnessMax;

    if ('colorTempMin' in this.deviceConfig.options) TuyaColorTemperatureRange.minValue = this.deviceConfig.options.colorTempMin;
    if ('colorTempMax' in this.deviceConfig.options) TuyaColorTemperatureRange.maxValue = this.deviceConfig.options.colorTempMax;

    if ('saturationMin' in this.deviceConfig.options) TuyaSaturationRange.minValue = this.deviceConfig.options.saturationMin;
    if ('saturationMax' in this.deviceConfig.options) TuyaSaturationRange.maxValue = this.deviceConfig.options.saturationMax;

    if ('lightnessMin' in this.deviceConfig.options) TuyaLightnessRange.minValue = this.deviceConfig.options.lightnessMin;
    if ('lightnessMax' in this.deviceConfig.options) TuyaLightnessRange.maxValue = this.deviceConfig.options.lightnessMax;

    //"featuers" is the section in config where supprted lightbulb modes are listed
    //By default the bulb will only turn on and off and will have no conrols.
    //All supprted modes should be listed in a single string separated with spaces,
    //for example:
    // ...
    // "features": "dimmable colortemp"
    // ...
    if ('features' in this.deviceConfig) {
      this.features = {
        dimmable: this.deviceConfig.features.indexOf('dimmable') != -1,
        colortemp: this.deviceConfig.features.indexOf('colortemp') != -1,
        rgb: this.deviceConfig.features.indexOf('rgb') != -1,
      }
    }
    this.features = this.features || {};

    //Current state where all changes accumulate
    this.currentState = new LightbulbState();
    //The "old" state which carries the state of the last applied settings
    this.oldState = this.currentState.copy();

    this.device = new TuyaDevice(deviceConfig);
    this.device.connect();

    this.device.on(
      'data',
      function(data, command) {
        if (data !== undefined) {
          this.log.debug('Updating', this.homebridgeAccessory.displayName, data, command);
          //When applying changes from the DPS list, all found
          //mapped DPS will be applied and the set of HomeKit characteristics
          //to update will be returned.
          //The updates are array of objects like { set: characterstic, value: xxx}
          var updates = this.currentState.updateFromDps(data.dps);
          //Since this is an update from Tuya device, this is it's current state,
          //so we make oldState shoud match currentState in order to make sure
          //we keep making changes based on the actual lightbulb state.
          this.oldState = this.currentState.copy();

          //We go through all the updates returned and apply them
          for (var i in updates) {
            var update = updates[i];
            this.homebridgeAccessory.getService(Service.Lightbulb)
            .getCharacteristic(update.set)
            .updateValue(update.value);
          }
        } else {
          this.log.debug('No data');
        }
      }.bind(this)
    );

    this.device.on(
      'error',
      function(data) {
        this.log.debug('ERROR: not responding', this.homebridgeAccessory.displayName);
        this.homebridgeAccessory
          .getService(Service.Lightbulb)
          .getCharacteristic(Characteristic.On)
          .updateValue(new Error('Not Responding'));
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
        //Schedule the changes
        this.scheduleChange(callback);
      });

    if (this.features.dimmable) {
      var brightness = this.lightbulbService.getCharacteristic(Characteristic.Brightness);

      //We update HomeKitBrightnessRange to match the actual values
      HomeKitBrightnessRange.minValue = brightness.props.minValue;
      HomeKitBrightnessRange.maxValue = brightness.props.maxValue;

      brightness.on('set', (value, callback) => {
        this.log.debug('[%s] On set brightness', this.homebridgeAccessory.displayName);
        this.currentState.isOn = value > HomeKitBrightnessRange.minValue;
        if (this.currentState.isOn) {
          if (this.currentState.opMode == OperationMode.white) {
            this.currentState.brightness.set(value, HomeKitBrightnessRange);
          } else if (this.currentState.opMode == OperationMode.color) {
            this.currentState.color.V = value;
          }
        }
        //Schedule the changes
        this.scheduleChange(callback);
      });
    }

    if (this.features.colortemp) {
      var colorTemperature = this.lightbulbService.getCharacteristic(Characteristic.ColorTemperature);

      //We update HomeKitColorTemperatureRange to match the actual values
      HomeKitColorTemperatureRange.minValue = colorTemperature.props.minValue;
      HomeKitColorTemperatureRange.maxValue = colorTemperature.props.maxValue;

      colorTemperature.on('set', (value, callback) => {
        this.log.debug('[%s] On set color temperature', this.homebridgeAccessory.displayName);
        this.currentState.colorTemperature.set(value, HomeKitColorTemperatureRange, true);
        //Schedule the changes
        this.scheduleChange(callback);
      })
    }

    if (this.features.rgb) {
      this.lightbulbService
        .getCharacteristic(Characteristic.Hue)
        .on('set', (value, callback) => {
          this.log.debug('[%s] On set color hue', this.homebridgeAccessory.displayName);
          //The color data is stored in HomeKit values
          this.currentState.color.H = value;
          //In color mode, the brightness deifnes the color Value component.
          //We set it here to make sure it is correctly applied
          this.currentState.color.V = this.currentState.brightness.to(HomeKitBrightnessRange);
          //Schedule the changes
          this.scheduleChange(callback);
        });

      this.lightbulbService
        .getCharacteristic(Characteristic.Saturation)
        .on('set', (value, callback) => {
          this.log.debug('[%s] On set color hue', this.homebridgeAccessory.displayName);
          //The color data is stored in HomeKit values
          this.currentState.color.S = value;
          //In color mode, the brightness deifnes the color Value component.
          //We set it here to make sure it is correctly applied
          this.currentState.color.V = this.currentState.brightness.to(HomeKitBrightnessRange);
          //Schedule the changes
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
    if (typeof(this.updateCallback) == 'function') this.updateCallback();
    this.updateCallback = callback;
    this.updateTimer = setTimeout(() => {
      var commands = this.oldState.commandsToMatch(this.currentState);
      this.oldState = this.currentState.copy();
      this.device.setMany(commands, this.updateCallback);
      this.updateCallback = null;
    }, 100);
  }

}

module.exports = LightbulbAccessory;

/******** Helper Classes ********/

/*
  Enum with color modes.
  Tuya bulbs support
*/
var OperationMode = {
  color: "colour",
  white: "white"
}
Object.freeze(OperationMode);

/*
  Returns hex representation of the Number with given size in bytes
  For example, for 10.hex() will return 0A, for 10.hex(2) will return 0000A
*/
Number.prototype.hex = function(bytes) {
  bytes = bytes || 1
  return ("00".repeat(bytes) + this.toString(16)).slice(-bytes * 2)
}

/*
  Range reperesntation. Allows converting between ranges.
  Useful helper since Tuya and HomeKit have almost all values in different
  ranges.
*/
class ValueRange {
  constructor(minValue, maxValue) {
    this.minValue = minValue;
    this.maxValue = maxValue;
  }
  convert(value, toRange) {
    var selfLength = this.maxValue - this.minValue
    var targetLength = toRange.maxValue - toRange.minValue
    var coef = targetLength / selfLength
    return Math.round((value - this.minValue) * coef + toRange.minValue);
  }
}

/*
  A range dependent value.
  Carries the value and the range the value is in.
  Alllows representing the value in different ranges, as well as
  setting the value from a different range.

  Example:

  var range = new ValueRange(0, 255);
  var percent = new ValueRange(0, 100)

  var v = new Value(127, range);
  console.log(v.to(percent)); //Outputs 50 (127 is 50% for the 0...255 range)
  v.set(100, percent);        //We update value using percentage
  console.log(v.value);       //Outputs 255 (which is 100% of 0...255 range)

*/
class Value {
  constructor(value, range) {
    this.value = value;
    this.range = range;
  }
  copy() {
    return new Value(this.value, this.range);
  }
  /*
    Converts value to the given range. Can invert the value if needed.
    For example, the color temperature ranges in Tuya and HomeKit are inverted.
  */
  to(range, invert) {
    return this.range.convert(invert ? this.range.maxValue - this.value : this.value, range);
  }
  /*
    Sets the value to the given value, which is in the specified range.
    Can handle inverted values like to(range, invert).
    Useful when updating Value instances.
  */
  set(value, inRange, invert) {
    var val = inRange.convert(value, this.range);
    this.value = invert ? this.range.maxValue - val : val;
  }
}


/*
  A little extension to Tuyapi allowing sequential execution of a set of commands.
  This is needed in order to simplify the state updates.
  The supplied chain of commands is executed sequentially until no commands
  are left, then the callback is called if any.
  This allows setting, for example, color temperature along with operation mode
  in one call (to apply color temperature, you also have to change the operation
  mode, if the bulb is not in "white" mode).
*/
TuyaDevice.prototype.setMany = function(commands, callback) {
  callback = callback || function() {}
  if (commands.length <= 0) {
    callback();
    return
  }

  var command = commands.shift()
  this.set(command).then(() => {
    this.setMany(commands, callback)
  }).catch(error => {
    callback(error);
  })
}



// Set of defined ranges with the defaults
// The defaults are taken from:
// HAP: https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js
// Tuya: https://docs.tuya.com/en/openapi/standardFunction/dj_standard_functions.html

var TuyaBrightnessRange = new ValueRange(25, 255);
var HomeKitBrightnessRange = new ValueRange(0, 100);

var TuyaColorTemperatureRange = new ValueRange(0, 255);
var HomeKitColorTemperatureRange = new ValueRange(140, 500);

var TuyaSaturationRange = new ValueRange(0, 255);
var HomeKitSaturationRange = new ValueRange(0, 100);

var TuyaLightnessRange = new ValueRange(0, 255);
//The corresponding HomeKit range for TuyaLightnessRange is HomeKitBrightnessRange

//We don't use value ranges for Hue since both Tuya and HomeKit operate in the same range.

/*
  Color in HSV model.
  Tuya uses both, RGB and HSV notation.
  For example, to set color, the following sequence is sent:
  [3 bytes RGB code][2 bytes Hue][1 byte Saturation][1 byte Value]

  HomeKit does not need RGB color, plus RGB can be acquired from HSV components,
  so this class carries HSV values in HomeKit(!) ranges and allows converting
  to and from Tuya hex string needed for color operation.
*/
class Color {
  constructor() {
    this.H = 0;
    this.S = 0;
    this.V = 0;
  }

  copy() {
    var color = new Color()
    color.H = this.H;
    color.S = this.S;
    color.V = this.V;
    return color;
  }

  copyFrom(color) {
    this.H = color.H;
    this.S = color.S;
    this.V = color.V;
  }

  /*
    Returns Tuya hex in format [RGB][H][S][V] (7 bytes, 14 hex symbols)
  */
  toTuyaHex() {
    //Tuya stores color in the following format [3 byte RGB color][2 byte H][1 byte S][1 byte V]
    var rgb = Convert.hsv.rgb(this.H, this.S, this.V);
    var h = Convert.rgb.hex(rgb) + this.H.hex(2) + this.S.hex() + this.V.hex();
    return h.toLowerCase();
  }
  /*
    Parses Tuya hex notation.
    Ignores RGB value, uses only HSV values.

    Returns true if the value has been parsed. False otherwise.
  */
  fromTuyaHex(value) {
    //Tuya stores color in the following format [3 byte RGB color][2 byte H][1 byte S][1 byte V]
    if (value.length != 14) return false; //Somehting wrong with the format
    //We only need HSL part
    this.H = parseInt(value.substring(6, 10), 16);
    this.S = parseInt(value.substring(10, 12), 16);
    this.V = parseInt(value.substring(12, 14), 16);

    return true
  }
}


/*
  The complete sate of the lightbulb.
  All values here are in Tuya(!) ranges.
*/
class LightbulbState {
  constructor() {
    this.isOn = false;
    this.opMode = OperationMode.white;
    this.brightness = new Value(0, TuyaBrightnessRange);
    this.color = new Color()
    this.colorTemperature = new Value(0, TuyaColorTemperatureRange);
  }

  copy() {
    var state = new LightbulbState(this);
    state.isOn = this.isOn;
    state.opMode = this.opMode;
    state.brightness.value = this.brightness.value;
    state.color.copyFrom(this.color);
    state.colorTemperature.value = this.colorTemperature.value;
    return state;
  }

  /*
    Updates the state from the provided DPS data.
    Picks the values according to DpsMap, if those are present in the update.
    Produces a set of changes needed to be applied to HomeKit for simplified
    execution.
    The output format is the array of objects.
    All returned values are in HomeKit(!) value ranges.

    For example:
    [
      {
        set: Characteristic.Brightness,
        value: 10
      },
      {
        set: Characteristic.ColorTemperature,
        value: 480
      }
    ]
  */
  updateFromDps(dpsData) {
    var instructions = Array()
    for (var dps in dpsData) {
      dps = parseInt(dps);
      switch (dps) {
        case DpsMap.onOff:
          this.isOn = dpsData[dps];
          instructions.push({
            set: Characteristic.On,
            value: dpsData[dps]
          });
          break;
        case DpsMap.opMode:
          this.opMode = dpsData[dps];
          break;
        case DpsMap.brightness:
          this.brightness.value = dpsData[dps];
          instructions.push({
            set: Characteristic.Brightness,
            value: this.brightness.to(HomeKitBrightnessRange)
          });
          break;
        case DpsMap.colorTemperature:
          this.colorTemperature.value = dpsData[dps];
          instructions.push({
            set: Characteristic.ColorTemperature,
            value: this.colorTemperature.to(HomeKitColorTemperatureRange, true)
          });
          break;
        case DpsMap.color:
          this.color.fromTuyaHex(dpsData[dps]);
          instructions.push({
            set: Characteristic.Hue,
            value: this.color.H
          });
          instructions.push({
            set: Characteristic.Saturation,
            value: this.color.S
          });
          break;
        default:
          //There are couple unsupported properties currently for scenes, so we are ignoring them for now
          break;
      }
    }

    return instructions;
  }

  /*
    Creates a set of Tuyapi commands to make the current state correspond the given state.
    Method identifies the differences between this state and the given state,
    then for each difference it generates a command(s) with operation(s) needed
    to transition the device to the given state.

    Returns the set of commands to execute to put the device in the given state.
    The returned set can be directly executed with Tuyapi.
  */
  commandsToMatch(state) {
    var changes = []

    if (this.isOn != state.isOn) {
      changes.push({
        dps: DpsMap.onOff,
        set: state.isOn
      })
    }
    if (this.opMode != state.opMode) {
      changes.push({
        dps: DpsMap.opMode,
        set: state.opMode
      })
    }

    //We only update brightness if the bulb is in "white" mode. Otherwise the HomeKit
    //brightness is used as Value component for the color and we don't need to change the
    //actual brightness value in the bulb.
    if (this.brightness.value != state.brightness.value && this.opMode == OperationMode.white) {
      changes.push({
        dps: DpsMap.brightness,
        set: state.brightness.value
      })
    }

    if (this.colorTemperature.value != state.colorTemperature.value) {
      //In order for color temperature to change, the bulb has to be in "white" mode.
      //So if it's not true, we add a command to set it to "white" mode.
      if (this.opMode != OperationMode.white) {
        changes.push({
          dps: DpsMap.opMode,
          set: OperationMode.white
        });
      }
      changes.push({
        dps: DpsMap.colorTemperature,
        set: state.colorTemperature.value
      });
    }

    if (this.color.toTuyaHex() != state.color.toTuyaHex()) {
      //In order for color to take effect, the bulb has to be in "colour" mode.
      //So if it's not true, we add a command to set it to "colour" mode.
      if (this.opMode != OperationMode.color) {
        changes.push({
          dps: DpsMap.opMode,
          set: OperationMode.color
        });
      }
      changes.push({
        dps: DpsMap.color,
        set: state.color.toTuyaHex()
      });
    }

    return changes
  }
}
