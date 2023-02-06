<p align="center">
    <img src="https://raw.githubusercontent.com/iRayanKhan/homebridge-tuya/main/assets/Tuya-Plugin-Branding.png" height="100"><br>
</p>


<span align="center">

# Homebridge-Tuya

[![npm](https://img.shields.io/npm/v/homebridge-tuya.svg)](https://www.npmjs.com/package/homebridge-tuya)
[![npm](https://img.shields.io/npm/dt/homebridge-tuya.svg)](https://www.npmjs.com/package/homebridge-tuya)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)


</span>



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
> Click the number next to your device to find the possible DataPoint "DP" values, then add as needed to your config.

* Air Conditioner<sup>[1](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#air-conditioners)</sup> 
* Air Purifiers<sup>[2]()</sup>
* Convectors<sup>[3](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#heat-convectors)</sup>
* Dehumidifers<sup>[4](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types)</sup>
* Dimmers<sup>[5](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#simple-dimmers)</sup>
* Fan<sup>[6](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types)</sup>
* Fan v2<sup>[7](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types)</sup>
* Garages<sup>[8](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#garage-doors)</sup>
* Heaters<sup>[9](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types)</sup>
* Lights
  * On/Off<sup>[10](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types)</sup>
  * Brightness<sup>[11](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#tunable-white-light-bulbs)</sup>
  * Color<sup>[12](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#white-and-color-light-bulbs)</sup> (Hue, Saturation, Adaptive Lighting)
* Oil Diffusers<sup>[13](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types)</sup>
* Outlets<sup>[14](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types#outlets)</sup>
* Switches<sup>[15](https://github.com/iRayanKhan/homebridge-tuya/wiki/Supported-Device-Types)</sup>

Note: Motion, and other sensor types don't behave well with responce requests, so they will not be added. 


## Installation Instructions

#### Option 1: Install via Homebridge Config UI X:

Search for "Tuya" in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x) and install `homebridge-tuya`.

#### Option 2: Manually Install:

```
sudo npm install -g homebridge-tuya
```

## Configuration
> UI

1. Navigate to the Plugins page in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x).
2. Click the **Settings** button for the Tuya plugin.
3. Add your device types
4. Add device parameters<sup>[10](apple.com/)</sup>
5. Restart Homebridge for the changes to take effect.

> Manual

1. Edit the config.json file to add your device types, and parameters. 
2. Restart Homebridge


## Known Issues

1. If your devices add, but you can't control them, make sure you entered the DataPoint "DP" values for your device. 

## Troubleshooting
1. Make sure the plugin is up-to date
2. Check for existing issues


## Contributing

If you have new accessory logic for a new device, please add a function defined by manufacturer, and describe your changes in the readME file. 

## Credits

* [AMoo-Miki](https://github.com/AMoo-Miki) - developer of the [Tuya-Lan](https://github.com/AMoo-Miki/homebridge-tuya-lan) plugin which this plugin is based off. 
* mxDanger - Plugin branding.
* [CodeTheWeb](https://github.com/CodeTheWeb) - developer of [TuyaApi](https://github.com/codetheweb/tuyapi), who gratiously provided this repo's name.
* [Oznu](https://github.com/oznu) - developer of Homebridge, added ```config.schema.json``` , fixed dependencies, and helped inspire this readME off his [gsh](https://github.com/oznu/homebridge-gsh) plugin.

## License



## Donating

Please donate to a local pet shelter, or food pantry. It's been a wild time, but we can do our part by helping others. 
