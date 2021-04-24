# Changelog

All notable changes to this project will be documented in this file. This project uses [semantic versioning](https://semver.org/).

## 2.0.1 (2021-03-25)
This update includes the following changes:

[+] Fixes [#233](https://github.com/iRayanKhan/homebridge-tuya/issues/233#issue-833662092), where tempature divisor was not applying, thanks @xortuna [#238](https://github.com/iRayanKhan/homebridge-tuya/pull/238)

[!] Note: The next release of this plugin (2.1.0) will change the config to "Tuya", instead of "TuyaLan". No change is needed 'till 2.1.0 is released.
I am in need of beta testers for 2.1.0 once the next beta goes live, please stay tuned in the homebridge discord server for an announcement. 

## 2.0.0 (2021-03-12)
This update includes the following changes:

* [+] Verified by Homebridge. [#264](https://github.com/homebridge/verified/issues/264)
* [!] Note: The next release of this plugin (2.1.0) will change the config to "Tuya", instead of "TuyaLan". No change is needed 'till 2.1.0 is released.


## 1.5.1 (2021-03-02)
This update includes the following changes:

* [+] Fix garage door accessory for Wofea devices, thanks @pelletip [#221](https://github.com/iRayanKhan/homebridge-tuya/pull/221)

* [+] Fix log prefix for the following device types: BaseAccessory, RGBTWLight, SimpleBlinds(1), SimpleBlinds2, SimpleFanLight, SimpleHeater, SimpleLight, TuyaAccessory, and ValveAccessory.

* [!] Warning: V2.0 will be released once this plugin is verified. The platform name will change from TuyaLan to just Tuya. Please be prepared once V2.0 comes out. No action is required at this time. 

## 1.5.0 (2021-02-28)
This update includes the following changes:

* Updated dependencies [#215](https://github.com/iRayanKhan/homebridge-tuya/pull/215) + [#216](https://github.com/iRayanKhan/homebridge-tuya/pull/216)
* Removed plugin prefix from Manufacturer (may have to clear cachedAccessories)
* Fix crash on launch for garage accessory "ReferenceError: dps is not defined" [#201](https://github.com/iRayanKhan/homebridge-tuya/pull/201) Thanks @longzheng
* Added dpStatus configuration for Wofea garage door [#202](https://github.com/iRayanKhan/homebridge-tuya/pull/202) Thanks @longzheng
* Allow more numbers and strings for cmdLow, and cmdHigh [#204](https://github.com/iRayanKhan/homebridge-tuya/pull/204) Thanks @fra-iesus
* Note: If you have custom logic or support for an unsupported accessory, please open a PR so it can be merged in!
* Note: Update to Homebridge v1.3.1 to fix "No Response" for TW/RGBTW Lights. 

## 1.4.0 (2021-02-14)
Happy Valentines day!
This update includes the following changes, courtesy of @davidh2075:

* CachedAccessories Displayname now sync with the configuration [#196](https://github.com/iRayanKhan/homebridge-tuya/pull/196)
* Fix for ECONNRESET spam [#197](https://github.com/iRayanKhan/homebridge-tuya/pull/197)
* Support for Kogan garage door accessory [#198](https://github.com/iRayanKhan/homebridge-tuya/pull/198)


## 1.3.0 (2021-01-25)
* Added Adaptive Lighting to TW/RGBTW bulbs. Thanks @tom-23 [186]


## 1.2.0 (2021-01-05)
* Fix UDP errors in log, thanks @Giocirque [#78]
* Merged fix for simpleFanLightAccessory DS-03 support, thanks @sholleman [#168]


## 1.1 (2020-10-28)
* Added Changelog.md
* Added Oil Diffuser accessory, thanks @nitaybz    (#144) 
* Added Dehumidifier accessory, thanks @fra-iesus  (#143)
* Added AirPurifier  accessory, thanks @dhutchison (#139)

