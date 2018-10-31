# homebridge-tuya

🏠 Offical Homebridge plugin for [TuyAPI](https://github.com/codetheweb/tuyapi).

## Installation

```
npm i homebridge-tuya -g
```

## Example config.json

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

See [this page](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md) for finding the above parameters.

When using parameters from captured requests/responses, seek for `devId` or `uuid` for `id` field, and `localKey` for `key` field.

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
