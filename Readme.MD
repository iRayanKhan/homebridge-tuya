<span align="center">

# Homebridge-Tuya

</span>


Control your supported Tuya accessories locally in HomeKit

* [Why This Fork?](#why-this-fork-exists)
* [Supported Device Types](#supported-device-types)
* [Installation Instructions](#installation-instructions)
* [Configuration](#configuration)
* [Known Issues](#known-issues)
* [Troubleshooting](#troubleshooting)
* [Credits](#credits)
* [License](#license)

## Why This Fork Exists

We recently bought a new house that comes with a WiFi thermostat which controls the electric floor heating in our bathroom. The make and model of which are [Magnum MRC Remote control]( https://www.magnumheating.com/products/58-1-electrical+systems/p-303-magnum+remote+control) which is supported by an OEM white label Tuya application. Unfortunately this app does not directly integrate with HomeKit, therefore a Homebridge plugin was required. The current version of the plugin that this fork is based of [homebridge-tuya](https://github.com/iRayanKhan/homebridge-tuya) does not provide support for thermostat devices where custom names are provided to select specific heating schedules. In the case of our thermostat,  **AUTO** runs the regular schedule, and **MANUAL**, **FROST** or **HOLIDAY** should be used to deviate from the regular programming.

This plugin aims to solve this need by splitting out the operational state of the thermostat (heating vs. idle), and the currently active heating mode (schedule vs. override), and provides the option to use the devices own enumerations for each operating state

For our specific device [MRC Remote control](https://www.magnumheating.com/products/58-1-electrical+systems/p-303-magnum+remote+control) these are the required settings:

| Function | Name in config | DP | Possible Values |
| --- | --- | --- | --- |
| Heating indicator | dpActive | 118 | "warming" (corresponds to idle) / "heating" (corresponds to heating) |
| Program status | dpProgramState | 103 | "AUTO" / "MANUAL" / "FROST" / "HOLIDAY" |
| Desired temperature | dpDesiredTemperature | 102 | temperature multiplied by 10 |
| Current temperature | dpCurrentTemperature | 106 | temperature multiplied by 10 |


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
* Thermostats (added in this fork)

Note: Motion, and other sensor types don't behave well with responce requests, so they will not be added. 


## Installation Instructions

#### Option 1: Install via Homebridge Config UI X:

1. Search for "Tuya" in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x) and install `homebridge-tuya`.
2. Overwrite the **./index.js**, **./lib/SimpleThermostatAccessory** and **./config.schema.json**

#### Option 2: Manually Install:

1. Run the following npm command:
```
sudo npm install -g homebridge-tuya
```
2. Overwrite the **./index.js**, **./lib/SimpleThermostatAccessory** and **./config.schema.json**


## Configuration
> UI

1. Navigate to the Plugins page in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x).
2. Click the **Settings** button for the Tuya plugin.
3. Add your device types.
4. Add device parameters.
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
* [iRayanKhan](https://github.com/iRayanKhan) - developer of the [homebridge-tuya](https://github.com/iRayanKhan/homebridge-tuya) plugin which this is a fork off.
* mxDanger - Plugin branding.
* [CodeTheWeb](https://github.com/CodeTheWeb) - developer of [TuyaApi](https://github.com/codetheweb/tuyapi), who gratiously provided this repo's name.
* [Oznu](https://github.com/oznu) - developer of Homebridge, added ```config.schema.json``` , fixed dependencies, and helped inspire this readME off his [gsh](https://github.com/oznu/homebridge-gsh) plugin.

## License