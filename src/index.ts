import {
    API,
    APIEvent,
    CharacteristicEventTypes,
    CharacteristicSetCallback,
    CharacteristicValue,
    DynamicPlatformPlugin,
    HAP,
    Logging,
    PlatformAccessory,
    PlatformAccessoryEvent,
    PlatformConfig,
  } from "homebridge";
  

import {TuyaAccessory} from './lib/TuyaAccessory';
import TuyaDiscovery from './lib/TuyaDiscovery';

import OutletAccessory from './lib/OutletAccessory';
import SimpleLightAccessory from './lib/SimpleLightAccessory';
import MultiOutletAccessory from './lib/MultiOutletAccessory';
import CustomMultiOutletAccessory from './lib/CustomMultiOutletAccessory';
import RGBTWLightAccessory from './lib/RGBTWLightAccessory';
import RGBTWOutletAccessory from './lib/RGBTWOutletAccessory';
import TWLightAccessory from './lib/TWLightAccessory';
import AirConditionerAccessory from './lib/AirConditionerAccessory';
import AirPurifierAccessory from './lib/AirPurifierAccessory';
import DehumidifierAccessory from './lib/DehumidifierAccessory';
import ConvectorAccessory from './lib/ConvectorAccessory';
import GarageDoorAccessory from './lib/GarageDoorAccessory';
import SimpleDimmerAccessory from './lib/SimpleDimmerAccessory';
import SimpleDimmer2Accessory from './lib/SimpleDimmer2Accessory';
import SimpleBlindsAccessory from './lib/SimpleBlindsAccessory';
import SimpleBlinds2Accessory from './lib/SimpleBlinds2Accessory';
import SimpleHeaterAccessory from './lib/SimpleHeaterAccessory';
import SimpleFanAccessory from './lib/SimpleFanAccessory';
import SimpleFanLightAccessory from './lib/SimpleFanLightAccessory';
import SwitchAccessory from './lib/SwitchAccessory';
import ValveAccessory from './lib/ValveAccessory';
import OilDiffuserAccessory from './lib/OilDiffuserAccessory';

const PLUGIN_NAME = 'homebridge-tuya-lan';
const PLATFORM_NAME = 'TuyaLan';

const CLASS_DEF = {
    outlet: OutletAccessory,
    simplelight: SimpleLightAccessory,
    rgbtwlight: RGBTWLightAccessory,
    rgbtwoutlet: RGBTWOutletAccessory,
    twlight: TWLightAccessory,
    multioutlet: MultiOutletAccessory,
    custommultioutlet: CustomMultiOutletAccessory,
    airconditioner: AirConditionerAccessory,
    airpurifier: AirPurifierAccessory,
    dehumidifier: DehumidifierAccessory,
    convector: ConvectorAccessory,
    garagedoor: GarageDoorAccessory,
    simpledimmer: SimpleDimmerAccessory,
    simpledimmer2: SimpleDimmer2Accessory,    
    simpleblinds: SimpleBlindsAccessory,
    simpleblinds2: SimpleBlinds2Accessory,
    simpleheater: SimpleHeaterAccessory,
    switch: SwitchAccessory,
    fan: SimpleFanAccessory,
    fanlight: SimpleFanLightAccessory,
    watervalve: ValveAccessory,
    oildiffuser: OilDiffuserAccessory
} as const;

let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, TuyaLan);
};


// let Characteristic, PlatformAccessory, Service, Categories, AdaptiveLightingController, UUID;

// module.exports = function(homebridge) {
//     ({
//         platformAccessory: PlatformAccessory,
//         hap: {Characteristic, Service, AdaptiveLightingController, Accessory: {Categories}, uuid: UUID}
//     } = homebridge);

//     homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, TuyaLan, true);
// };

type TuyaLanConfig = PlatformConfig & {
    devices: {
        id: string;
        key: string;
        type: string;
        name?: string;
        ip?: string;
        fake?: boolean;
    }[];
};

class TuyaLan implements DynamicPlatformPlugin {
    private readonly log: Logging;
    private readonly api: API;

    private config: TuyaLanConfig;
    private cachedAccessories: Map<string, PlatformAccessory>;
    private _expectedUUIDs: string[];

    constructor(log: Logging, config: PlatformConfig, api: API) {
        this.log = log;
        this.config = config as TuyaLanConfig;
        this.api = api;

        this.cachedAccessories = new Map();
        // todo: fix type
        (this.api.hap as any).EnergyCharacteristics = require('./lib/EnergyCharacteristics')(this.api.hap.Characteristic);

        if(!this.config || !this.config.devices) {
            this.log("No devices found. Check that you have specified them in your config.json file.");
            throw new Error();
        }

        this._expectedUUIDs = this.config.devices.map(device => this.api.hap.uuid.generate(PLUGIN_NAME +(device.fake ? ':fake:' : ':') + device.id));

        this.api.on('didFinishLaunching', () => {
            this.discoverDevices();
        });
    }

    discoverDevices() {
        const devices: Record<string, any> = {};
        const connectedDevices: string[] = [];
        // todo: fix type
        const fakeDevices: any[] = [];
        this.config.devices.forEach(device => {
            try {
                device.id = ('' + device.id).trim();
                device.key = ('' + device.key).trim();
                device.type = ('' + device.type).trim();

                device.ip = ('' + (device.ip || '')).trim();
            } catch(ex) {}

            //if (!/^[0-9a-f]+$/i.test(device.id)) return this.log.error('%s, id for %s, is not a valid id.', device.id, device.name || 'unnamed device');
            if (!/^[0-9a-f]+$/i.test(device.key)) return this.log.error('%s, key for %s (%s), is not a valid key.', device.key.replace(/.{4}$/, '****'), device.name || 'unnamed device', device.id);
            if (!{16:1, 24:1, 32: 1}[device.key.length]) return this.log.error('%s, key for %s (%s), doesn\'t have the expected length.', device.key.replace(/.{4}$/, '****'), device.name || 'unnamed device', device.id);
            if (!device.type) return this.log.error('%s (%s) doesn\'t have a type defined.', device.name || 'Unnamed device', device.id);
            if (!Object.keys(CLASS_DEF).includes(device.type.toLowerCase())) return this.log.error('%s (%s) doesn\'t have a valid type defined.', device.name || 'Unnamed device', device.id);

            if (device.fake) fakeDevices.push({name: device.id.slice(8), ...device});
            else devices[device.id] = {name: device.id.slice(8), ...device};
        });

        const deviceIds = Object.keys(devices);
        if (deviceIds.length === 0) return this.log.error('No valid configured devices found.');

        this.log.info('Starting discovery...');

        TuyaDiscovery.start({ids: deviceIds})
            .on('discover', config => {
                if (!config || !config.id) return;
                if (!devices[config.id]) return this.log.warn('Discovered a device that has not been configured yet (%s@%s).', config.id, config.ip);

                connectedDevices.push(config.id);

                this.log.info('Discovered %s (%s) identified as %s (%s)', devices[config.id].name, config.id, devices[config.id].type, config.version);

                const device = new TuyaAccessory({
                    ...devices[config.id], ...config,
                    UUID: UUID.generate(PLUGIN_NAME + ':' + config.id),
                    connect: false
                });
                this.addAccessory(device);
            });

        fakeDevices.forEach(config => {
            this.log.info('Adding fake device: %s', config.name);
            this.addAccessory(new TuyaAccessory({
                ...config,
                UUID: UUID.generate(PLUGIN_NAME + ':fake:' + config.id),
                connect: false
            }));
        });

        setTimeout(() => {
            deviceIds.forEach(deviceId => {
                if (connectedDevices.includes(deviceId)) return;

                if (devices[deviceId].ip) {

                    this.log.info('Failed to discover %s (%s) in time but will connect via %s.', devices[deviceId].name, deviceId, devices[deviceId].ip);

                    const device = new TuyaAccessory({
                        ...devices[deviceId],
                        UUID: UUID.generate(PLUGIN_NAME + ':' + deviceId),
                        connect: false
                    });
                    this.addAccessory(device);
                } else {
                    this.log.warn('Failed to discover %s (%s) in time but will keep looking.', devices[deviceId].name, deviceId);
                }
            });
        }, 60000);
    }

    registerPlatformAccessories(platformAccessories) {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, Array.isArray(platformAccessories) ? platformAccessories : [platformAccessories]);
    }

    configureAccessory(accessory) {
        // also checks null objects or empty config - this._expectedUUIDs
        if (accessory instanceof PlatformAccessory && this._expectedUUIDs && this._expectedUUIDs.includes(accessory.UUID)) {
            this.cachedAccessories.set(accessory.UUID, accessory);
            accessory.services.forEach(service => {
                if (service.UUID === Service.AccessoryInformation.UUID) return;
                service.characteristics.some(characteristic => {
                    if (!characteristic.props ||
                        !Array.isArray(characteristic.props.perms) ||
                        characteristic.props.perms.length !== 3 ||
                        !(characteristic.props.perms.includes(Characteristic.Perms.WRITE) && characteristic.props.perms.includes(Characteristic.Perms.NOTIFY))
                    ) return;

                    this.log.info('Marked %s unreachable by faulting Service.%s.%s', accessory.displayName, service.displayName, characteristic.displayName);

                    characteristic.updateValue(new Error('Unreachable'));
                    return true;
                });
            });
        } else {
            /*
             * Irrespective of this unregistering, Homebridge continues
             * to "_prepareAssociatedHAPAccessory" and "addBridgedAccessory".
             * This timeout will hopefully remove the accessory after that has happened.
             */
            setTimeout(() => {
                this.removeAccessory(accessory);
            }, 1000);
        }
    }

    addAccessory(device) {
        const deviceConfig = device.context;
        const type = (deviceConfig.type || '').toLowerCase();

        const Accessory = CLASS_DEF[type];

        let accessory = this.cachedAccessories.get(deviceConfig.UUID),
            isCached = true;

        if (accessory && accessory.category !== Accessory.getCategory(Categories)) {
            this.log.info("%s has a different type (%s vs %s)", accessory.displayName, accessory.category, Accessory.getCategory(Categories));
            this.removeAccessory(accessory);
            accessory = null;
        }

        if (!accessory) {
            accessory = new PlatformAccessory(deviceConfig.name, deviceConfig.UUID, Accessory.getCategory(Categories));
            accessory.getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Manufacturer, deviceConfig.manufacturer || "Unknown")
                .setCharacteristic(Characteristic.Model, deviceConfig.model || "Unknown")
                .setCharacteristic(Characteristic.SerialNumber, deviceConfig.id.slice(8));

            isCached = false;
        }

        if (accessory && accessory.displayName !== deviceConfig.name) {
            this.log.info(
                "Configuration name %s differs from cached displayName %s. Updating cached displayName to %s ",
                deviceConfig.name, accessory.displayName, deviceConfig.name);
            accessory.displayName = deviceConfig.name;
        }

        this.cachedAccessories.set(deviceConfig.UUID, new Accessory(this, accessory, device, !isCached));
    }

    removeAccessory(homebridgeAccessory) {
        if (!homebridgeAccessory) return;

        this.log.warn('Unregistering', homebridgeAccessory.displayName);

        delete this.cachedAccessories[homebridgeAccessory.UUID];
        this.api.unregisterPlatformAccessories(PLATFORM_NAME, PLATFORM_NAME, [homebridgeAccessory]);
    }

    removeAccessoryByUUID(uuid) {
        if (uuid) this.removeAccessory(this.cachedAccessories.get(uuid));
    }
}
