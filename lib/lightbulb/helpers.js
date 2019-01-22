const Convert = require('color-convert');

/*
  Enum with color modes.
  Tuya bulbs support
*/
const OperationMode = {
  color: 'colour',
  white: 'white'
};
Object.freeze(OperationMode);

/*
  Returns hex representation of the Number with given size in bytes
  For example, for 10.hex() will return 0A, for 10.hex(2) will return 0000A
*/
function toLeftPaddedHex(n, padding) {
  padding = (padding || 1) * 2;

  return n.toString(16).padStart(padding, '0');
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
    const selfLength = this.maxValue - this.minValue;
    const targetLength = toRange.maxValue - toRange.minValue;
    const coef = targetLength / selfLength;
    return Math.round(((value - this.minValue) * coef) + toRange.minValue);
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
    const val = inRange.convert(value, this.range);
    this.value = invert ? this.range.maxValue - val : val;
  }
}

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
    const color = new Color();
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
    // Tuya stores color in the following format [3 byte RGB color][2 byte H][1 byte S][1 byte V]
    const rgb = Convert.hsv.rgb(this.H, this.S, this.V);
    const h = Convert.rgb.hex(rgb) + toLeftPaddedHex(this.H, 2) + toLeftPaddedHex(this.S) + toLeftPaddedHex(this.V);

    return h.toLowerCase();
  }

  /*
    Parses Tuya hex notation.
    Ignores RGB value, uses only HSV values.

    Returns true if the value has been parsed. False otherwise.
  */
  fromTuyaHex(value) {
    // Tuya stores color in the following format [3 byte RGB color][2 byte H][1 byte S][1 byte V]
    if (value.length !== 14) {
      return false;
    } // Somehting wrong with the format
    // We only need HSL part
    this.H = parseInt(value.substring(6, 10), 16);
    this.S = parseInt(value.substring(10, 12), 16);
    this.V = parseInt(value.substring(12, 14), 16);

    return true;
  }
}

/*
  The complete sate of the lightbulb.
  All values here are in Tuya(!) ranges.
*/
class LightbulbState {
  constructor(dpsMap, ranges, Characteristic) {
    this.DpsMap = dpsMap;
    this.ranges = ranges;
    this.Characteristic = Characteristic;

    this.isOn = false;
    this.opMode = OperationMode.white;
    this.brightness = new Value(0, this.ranges.TuyaBrightnessRange);
    this.color = new Color();
    this.colorTemperature = new Value(0, this.ranges.TuyaColorTemperatureRange);
  }

  copy() {
    const state = new LightbulbState(this.DpsMap, this.ranges, this.Characteristic);
    state.isOn = this.isOn;
    state.opMode = this.opMode;
    state.brightness.value = this.brightness.value;
    state.color.copyFrom(this.color);
    state.colorTemperature.value = this.colorTemperature.value;
    return state;
  }

  /*
    Updates the state from the provided DPS data.
    Picks the values according to this.DpsMap, if those are present in the update.
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
    const instructions = [];
    for (let dps in dpsData) {
      if (Object.prototype.hasOwnProperty.call(dpsData, dps)) {
        dps = parseInt(dps, 10);
        switch (dps) {
          case this.DpsMap.onOff:
            this.isOn = dpsData[dps];
            instructions.push({
              set: this.Characteristic.On,
              value: dpsData[dps]
            });
            break;
          case this.DpsMap.opMode:
            this.opMode = dpsData[dps];
            break;
          case this.DpsMap.brightness:
            this.brightness.value = dpsData[dps];
            instructions.push({
              set: this.Characteristic.Brightness,
              value: this.brightness.to(this.ranges.HomeKitBrightnessRange)
            });
            break;
          case this.DpsMap.colorTemperature:
            this.colorTemperature.value = dpsData[dps];
            instructions.push({
              set: this.Characteristic.ColorTemperature,
              value: this.colorTemperature.to(this.ranges.HomeKitColorTemperatureRange, true)
            });
            break;
          case this.DpsMap.color:
            this.color.fromTuyaHex(dpsData[dps]);
            instructions.push({
              set: this.Characteristic.Hue,
              value: this.color.H
            });
            instructions.push({
              set: this.Characteristic.Saturation,
              value: this.color.S
            });
            break;
          default:
          // There are couple unsupported properties currently for scenes, so we are ignoring them for now
            break;
        }
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
    let changes = {};

    if (this.isOn !== state.isOn) {
      changes[this.DpsMap.onOff] = state.isOn;
    }
    if (this.opMode !== state.opMode) {
      changes[this.DpsMap.opMode] = state.opMode;
    }

    // We only update brightness if the bulb is in "white" mode. Otherwise the HomeKit
    // brightness is used as Value component for the color and we don't need to change the
    // actual brightness value in the bulb.
    if (this.brightness.value !== state.brightness.value && this.opMode === OperationMode.white) {
      changes[this.DpsMap.brightness] = state.brightness.value;
    }

    if (this.colorTemperature.value !== state.colorTemperature.value) {
      // In order for color temperature to change, the bulb has to be in "white" mode.
      // So if it's not true, we add a command to set it to "white" mode.
      if (this.opMode !== OperationMode.white) {
        changes[this.DpsMap.opMode] = OperationMode.white;
      }

      changes[this.DpsMap.colorTemperature] = state.colorTemperature.value;
    }

    if (this.color.toTuyaHex() !== state.color.toTuyaHex()) {
      // In order for color to take effect, the bulb has to be in "colour" mode.
      // So if it's not true, we add a command to set it to "colour" mode.
      if (this.opMode !== OperationMode.color) {
        changes[this.DpsMap.opMode] = OperationMode.color;
      }

      changes[this.DpsMap.color] = state.color.toTuyaHex();
    }

    return changes;
  }
}

module.exports = {toLeftPaddedHex, ValueRange, LightbulbState, OperationMode, Value};
