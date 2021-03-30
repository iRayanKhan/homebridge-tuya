<p align="center">
    <img src="https://github.com/iRayanKhan/Assets-Repo/blob/master/Tuya-Plugin-Branding.png?raw=true" height="100"><br>
</p>

<span align="center">

# Homebridge-Tuya



</span>



[![npm](https://img.shields.io/npm/v/homebridge-gsh.svg)](https://www.npmjs.com/package/homebridge-tuya)
[![npm](https://img.shields.io/npm/dt/homebridge-gsh.svg)](https://www.npmjs.com/package/homebridge-tuya)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

Control your supported Tuya accessories locally in HomeKit

* [Supported Device Types](#supported-device-types)
* [Installation Instructions](#installation-instructions)
* [Configuration](#configuration)
* [Known Issues](#known-issues)
* [Troubleshooting](#troubleshooting)
* [Credits](#credits)
* [License](#license)
* [Donating](#donating)

## Supported Device Types
 Control Air Conditioners, AirPurifiers, Convectors, DeHumidifiers, Outlets, Oil Diffusers, Garages, Lights, Dimmers, Fans, Heaters, Switches, etc.

* Air Conditioner<sup>[1](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#air-conditioners)</sup> 
* Air Purifiers
* Convectors
* Dehumidifers
* Dimmers
* Outlets
* Oil Diffusers
* Garages
* Lights
  * On/Off
  * Brightness
  * Color (Hue/Saturation/Adaptive Lighting)
* Fan
* Fan v2
* Heaters
* Switches
* etc

Note: Motion, and other sensor types don't behave well with responce requests, so they will not be added. 


## Installation Instructions

#### Option 1: Install via Homebridge Config UI X:

Search for "Tuya" in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x) and install `homebridge-tuya`.

#### Option 2: Manually Install:

```
sudo npm install -g homebridge-tuya
```

## Configuration

1. Navigate to the Plugins page in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x).
2. Click the **Settings** button for the Tuya plugin.
3. Add your device types
4. Add device parameters<sup[10](apple.com/)</sup>
5. Restart Homebridge for the changes to take effect.


## Known Issues

1. If your devices add, but you can't control them, make sure you entered the DataPoint "DP" values for your device. 

## Troubleshooting



## Contributing

If you have new accessory logic for a new device, please add a function defined by manufacturer, and describe your changes in the readME file. 

## Credits

* [AMoo-Miki](https://github.com/AMoo-Miki - developer of the [Tuya-Lan](https://github.com/AMoo-Miki/homebridge-tuya-lan) plugin which this plugin is based off. 
* mxDanger - Plugin branding.
* [CodeTheWeb](https://github.com/CodeTheWeb) - developer of Tuya-CLI, who gratiously gave me this repo's name.
* [Oznu](https://github.com/oznu) - developer of Homebridge, added ```config.schema.json``` , based this readME off his gsh readME, and fixed dependencies.

## License



## Donating

Please donate to a local pet shelter, or food pantry. It's been a wild time, but we can do our part by helping others. 
