# homebridge-tuya

🏠 Offical Homebridge plugin for [TuyAPI](https://github.com/codetheweb/tuyapi).

## Installation

```
npm i homebridge-tuya -g
```

## Basic config.json

The `type` option can be used to indicate the device is a dimmer. It can be set to "dimmer" or "generic", if omitted it will default to generic.

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

Currently supported types (`type` field):

- `generic`: a device that has a single, boolean property (such as outlets, light switches, etc). Can be used in combination with the `dps` option to set a custom property.
- `dimmer`: light switches with dimmers
  - `options` can be used to specify alternate `dps` for `OnOff` and `brightness`, and `minVal` and `maxVal` can be specified for `brightness`. _(see advanced config)_

See [this guide](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md) for finding the `id` and `key`.

## Advanced

If you find that the built-in IP auto discovery doesn't work for your network setup, you can pass it in manually like so:

```javascript
{
  "name": "Tuya Device 1",
  "id": "xxxxxxxxxxxxxxxxxxxx",
  "key": "xxxxxxxxxxxxxxxx",
  "ip": "xxx.xxx.xxx.xxx"
}
```

For devices with more than one switch (for example, powerstrips), a config would look like this:

```javascript
"devices": [
  {
    "name": "Power strip main",
    "id": "power-strip-id",
    "key": "power-strip-key",
    "dps": 1
  },
  {
    "name": "Power strip USB",
    "id": "same-power-strip-id",
    "key": "same-power-strip-key",
    "dps": 2
  }
]
```

For `dimmer` devices you can optionally control the `dpsOn` (on/off switch), `dpsBright` (dimmer control), and the `minVal` and `maxVal` for brightness.

**Important**: The `minVal` and `maxVal` are raw values known to the target device and form the range that translates to a 0-100% scale in the Home App. Check the device specs before changing these.

```javascript
"devices": [
  {
    "name": "Tuya Dimmer Switch Device Advanced",
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
