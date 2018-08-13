const EventEmitter = require('events');
const TuyaDevice = require('tuyapi');

class TuyaDiscover extends EventEmitter {
  constructor(config) {
    super();

    this.config = config;
  }

  async startDiscovery() {
    for (const device of this.config) {
      if (device.ip) {
        this.emit('device-new', device);
      } else {
        try {
          // Construct a new device and resolve the IP
          const tuyaDevice = new TuyaDevice({id: device.id, key: device.key});

          // eslint-disable-next-line no-await-in-loop
          await tuyaDevice.resolveId({timeout: 20});

          device.ip = tuyaDevice.device.ip;

          this.emit('device-new', device);
        } catch (error) {
          console.log(error);
          console.log(device.id + ' was unable to be found. Please try using a static IP in your config.json.');
          this.emit('device-offline', {id: device.devId});
        }
      }
    }
  }
}

module.exports = TuyaDiscover;
