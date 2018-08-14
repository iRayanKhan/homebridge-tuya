# @tuyapi/homebridge
🏠 Offical Homebridge plugin for [TuyAPI](https://github.com/codetheweb/tuyapi).

## Installation

```
npm i @tuyapi/homebridge -g
```

## Example config.json

```javascript
{
  "platform": "TuyaPlatform",
  "name": "TuyaPlatform",
  "devices": [
    {
      "name": "Tuya Device 1",
      "id": "xxxxxxxxxxxxxxxxxxxx",
      "key": "xxxxxxxxxxxxxxxx"
    },
    {
      "name": "Tuya Device 2",
      "id": "xxxxxxxxxxxxxxxxxxxx",
      "key": "xxxxxxxxxxxxxxxx"
    }
  ]
}
```

See [this page](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md) for finding the above parameters.

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
