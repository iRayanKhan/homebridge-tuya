const TuyaDevice = require('tuyapi');

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

class Curtain {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    this.platform = platform;
    PlatformAccessory = platform.api.platformAccessory;

    ({Accessory, Service, Characteristic, uuid: UUIDGen} = platform.api.hap);

    this.log = platform.log;
    this.homebridgeAccessory = homebridgeAccessory;
    this.deviceConfig = deviceConfig;

    // Set option defaults
    this.deviceConfig.options = this.deviceConfig.options || {};

    // Default DPS
    if ('dps' in this.deviceConfig.options) {
    	this.dps = this.deviceConfig.options.dps;
    } else {
    	this.dps = 1;
    }

    // Default up value
    if ('upValue' in this.deviceConfig.options) {
      this.upValue = this.deviceConfig.options.upValue;
    } else {
      this.upValue = 1;
    }

    // Default down value
    if ('downValue' in this.deviceConfig.options) {
      this.downValue = this.deviceConfig.options.downValue;
    } else {
      this.downValue = 2;
    }

    // Default stop value
    if ('stopValue' in this.deviceConfig.options) {
      this.stopValue = this.deviceConfig.options.stopValue;
    } else {
      this.stopValue = 3;
    }

    // State variables
    this.lastPosition = 0;
    this.currentPositionState = 2;
    this.currentTargetPosition = 0;

    // Create new Tuya instance
    deviceConfig.persistentConnection = true;
    this.device = new TuyaDevice(deviceConfig);

    if (this.homebridgeAccessory) {
      // Accessory has already been added to Homebridge
      this.log.debug('Existing Accessory found [%s] [%s] [%s]', homebridgeAccessory.displayName, homebridgeAccessory.context.deviceId, homebridgeAccessory.UUID);
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      // Accessory must be added to Homebridge
      this.log.debug('Creating new Accessory %s', this.deviceConfig.id);
      this.homebridgeAccessory = new PlatformAccessory(this.deviceConfig.name, UUIDGen.generate(this.deviceConfig.id + this.deviceConfig.name), Service.WindowCovering);
      platform.registerPlatformAccessory(this.homebridgeAccessory);
    }

    // Set error handler for device
    this.device.on('error', error => {
      this.log(error);
    });

    // Get service object for accessory
    this.service = this.homebridgeAccessory.getService(Service.WindowCovering);

    // Set name
    if (this.service) {
      this.service.setCharacteristic(Characteristic.Name, this.deviceConfig.name);
    } else {
      this.log.debug('Creating new Service %s', this.deviceConfig.id);
      this.service = this.homebridgeAccessory.addService(Service.WindowCovering, this.deviceConfig.name);
    }

    // Bind characteristics
    // Current position (0 - 100)
    this.service.getCharacteristic(Characteristic.CurrentPosition)
      .on('get', this.getCurrentPosition.bind(this));

    // Position state
    // (0 => -, 1 => +, 2 => 0)
    this.service.getCharacteristic(Characteristic.PositionState)
      .on('get', this.getPositionState.bind(this));

    // Target position (0 - 100)
    this.service.getCharacteristic(Characteristic.TargetPosition)
      .on('get', this.getTargetPosition.bind(this))
      .on('set', this.setTargetPosition.bind(this));

    // Identify
    this.homebridgeAccessory.on('identify', (paired, callback) => {
      this.log.debug('[%s] identify', this.homebridgeAccessory.displayName);
    });
  }

  getCurrentPosition(callback) {
    this.log('Last saved position: %s', this.lastPosition);
    this.device.get();

    this.device.on('data', data => {
      if (typeof data === 'object' && 'dps' in data && data.dps[this.dps]) {
        this.lastPosition = ((data.dps[this.dps] == this.upValue) ? 100 : 0);
        this.log('Current position: %s', this.lastPosition);
      } else {
        this.device.get();
      }
    });

    callback(null, this.lastPosition);
  }

  getPositionState(callback) {
    this.log('Requsted position state: %s', this.currentPositionState);
    callback(null, this.currentPositionState);
  }

  getTargetPosition(callback) {
    this.log('Requested target postiion: %s', this.currentTargetPosition);
    callback(null, this.currentTargetPosition);
  }

  setTargetPosition(position, callback) {
    this.log('Set target position to: %s', position);

    // Set target position
    this.currentTargetPosition = position;

    // Check if we're already at the target position
    if (this.currentTargetPosition == this.lastPosition) {
      if (this.interval != null) clearInterval(this.interval);
      if (this.timeout != null) clearTimeout(this.timeout);

      this.log("Already here");
      callback(null);
      return;
    }

    // Moving up or down?
    const moveUp = (this.currentTargetPosition >= this.lastPosition);
    this.log((moveUp ? 'Moving up' : 'Moving down'));

    // Set position state
    this.currentPositionState = (moveUp ? 1 : 0);
    this.service.setCharacteristic(Characteristic.PositionState, this.currentPositionState);

    // Set physical property
    const setTo = (moveUp ? this.upValue : this.downValue);

    this.device.set({dps: this.dps.toString(), set: setTo.toString()}).then(result => {
      this.lastPosition = position;
      this.currentPositionState = 2;
      this.service.setCharacteristic(Characteristic.CurrentPosition, position);
      this.service.setCharacteristic(Characteristic.PositionState, 2);
      callback(null);
    });
  }
}

module.exports = Curtain;
