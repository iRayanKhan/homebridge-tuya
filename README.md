# homebridge-tuya

🏠 Offical Homebridge plugin for [TuyAPI](https://github.com/codetheweb/tuyapi).

## Installation

```
npm i homebridge-tuya -g
```

## Basic config.json

The `type` option can be used to indicate the device is a dimmer.   
The following types are supported:

- `generic` - default type, can only turn on or off;
- `dimmer`  - dimmable lightswitch;
- `lightbulb` - smart lightbulb;

It `types` is not specified, "generic" will be used.


```javascript
{
  "platform": "TuyaPlatform",
  "name": "TuyaPlatform",
  "devices": [
    {
      "name": "Tuya Outlet Device 1",
      "id": "xxxxxxxxxxxxxxxxxxxx",
      "key": "xxxxxxxxxxxxxxxx"
    },
    {
      "name": "Tuya Dimmer Switch Device 2",
      "id": "xxxxxxxxxxxxxxxxxxxx",
      "key": "xxxxxxxxxxxxxxxx",
      "type": "dimmer"
    }
  ]
}
```

Each `device` object passed to the `devices` array has these properties:

- `name`: the name that should appear in HomeKit.
- `id`: the ID of the device. See [this guide](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md) for finding the `id` and `key`.
- `key`: the key of the device. See above guide.
- `ip`: IP of device. Usually not necessary, add it if you have issues.
- `type`: the type of device. Currently supported device types.
- `options`: set of additional options based on device type.

## Device Specific Options

The "options" section can be used to fine-tune the settings for devices that are working with Tuya Cloud, but have settings different from the defaults. If no options specified, the defaults will be used. You only need to specify options that are different from the defaults.

Please also check our [Options for known devices](https://github.com/codetheweb/tuyapi/wiki/Device-Details), where we listed options for devices we know.

### Generic

The type `generic` is a default type, which specifies a device that has a single, boolean property (such as outlets, light switches, etc).

Options supported:

- `dps`: property index to control (defaults to 1).

Example Configuration:

```javascript
{
  "platform": "TuyaPlatform",
  "name": "TuyaPlatform",
  "devices": [
    {
      "name": "Tuya Outlet",
      "id": "xxxxxxxxxxxxxxxxxxxx",
      "key": "xxxxxxxxxxxxxxxx",
      "options": {
      		"dps": 1
      }
    }
  ]
}
```

### Dimmer

The type `dimmer` specifies a device that has an on/off value and a brightness value, such as light switches with dimmers. Also applicable to basic lightbulbs.

Options supported:

- `dpsOn`: property index to use for on/off commands (defaults to 1).
- `dpsBright`: property index to use for brightness control (defaults to 2).
- `minVal`: minimum brightness value (defaults to 11).
- `maxVal`: maximum brightness value (defaults to 244).

Example Configuration:

```javascript
{
  "platform": "TuyaPlatform",
  "name": "TuyaPlatform",
  "devices": [
    {
      "name": "Tuya Dimmer",
      "id": "xxxxxxxxxxxxxxxxxxxx",
      "key": "xxxxxxxxxxxxxxxx",
      "type" "dimmer",
      "options": {
      		"dpsOn": 1,
      		"dpsBright": 2,
      		"minVal": 11,
      		"maxVal": 244
      }
    }
  ]
}
```


### Lightbulb

The type `lightbulb` specifies a device that has the following set of features (not necessary all at once) — on/off, brightness value, color temperature, and RGB color.   
Not all smart bulbs are equal, some may have certain features, some may not. That's why there is additional device configuration parameter called `features`.   
Features are listed in a single space separated string. The following features are supported:

- `dimmable`: indicates that the lightbulb can be dimmed.
- `colortemp`: indicates color temperature support.
- `rgb`: indicates support for custom RGB color.

If no `features` are specified, only "on/off" will be available.

Options supported:

- `dpsOn`: property index to use for on/off commands (defaults to 1).
- `dpsBright`: property index to use for brightness control (defaults to 3).
- `dpsOpMode`: property index to use for mode control (color/white), etc. (defaults to 2).
- `dpsColortemp`: property index to use for color temperature control (defaults to 4).
- `dpsColor`: property index to control RGB color (defaults to 5).
- `brighnessMin`: minimum value for brightness (25 by default).
- `brighnessMax`: maximum value for brightness (255 by default).
- `colorTempMin`: minimum value for color temperature (0 by default).
- `colorTempMax`: maximum value for color temperature (255 by default).
- `saturationMin`: minimum value for saturation (0 by default).
- `saturationMax`: maximum value for saturation (255 by default).
- `lightnessMin`: minimum value for the color 'Value' in HSV scheme (0 by default).
- `lightnessMax`: maximum value for the color 'Value' in HSV scheme (255 by default).

Example Configuration:

```javascript
{
  "platform": "TuyaPlatform",
  "name": "TuyaPlatform",
  "devices": [
    {
      "name": "Tuya Lightbulb",
      "id": "xxxxxxxxxxxxxxxxxxxx",
      "key": "xxxxxxxxxxxxxxxx",
      "type" "lightbulb",
      "features": "dimmable colortemp rgb",
      "options": {
			"dpsOn": 1,
			"dpsBright": 3,
			"dpsOpMode": 2,
			"dpsColortemp": 4,
			"dpsColor": 5,
			"brighnessMin": 25,
			"brighnessMax": 255,
			"colorTempMin": 0,
			"colorTempMax": 255,
			"saturationMin": 0,
			"saturationMax": 255,
			"lightnessMin": 0,
			"lightnessMax": 255			
      }
    }
  ]
}
```


## Advanced

For devices with more than one switch (for example, powerstrips), a config would look like this:

```javascript
"devices": [
  {
    "name": "Power strip main",
    "id": "power-strip-id",
    "key": "power-strip-key",
    "options": {      
      "dps": 1
    }
  },
  {
    "name": "Power strip USB",
    "id": "same-power-strip-id",
    "key": "same-power-strip-key",
    "options": {      
      "dps": 2
    }
  }
]
```

Dimmer device example:

```javascript
"devices": [
  {
    "name": "Tuya Dimmer Switch Device",
    "id": "xxxxxxxxxxxxxxxxxxxx",
    "key": "xxxxxxxxxxxxxxxx",
    "type": "dimmer",
    "options": {      // Any or all of 'options' can be omitted
      "dpsOn": 2,     // Defaults to 1
      "dpsBright": 3, // Defaults to 2
      "minVal": 0,    // Defaults to 11
      "maxVal": 100   // Defaults to 244
    }
  }
]
```
