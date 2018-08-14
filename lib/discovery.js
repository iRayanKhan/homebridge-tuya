const EventEmitter = require('events');
const TuyaDevice = require('tuyapi');

class TuyaDiscover extends EventEmitter {
  constructor(log, config) {
    super();

    this.log = log;
    this.config = config;
  }

  async startDiscovery() {
    for (const device of this.config) {
      if (device.ip) {
        this.log.info('Device has IP: %s', device.id);

        this.emit('device-new', device);
      } else {
        try {
          // Construct a new device and resolve the IP
          const tuyaDevice = new TuyaDevice({id: device.id, key: device.key});

          // eslint-disable-next-line no-await-in-loop
          await tuyaDevice.resolveId();

          device.ip = tuyaDevice.device.ip;

          this.log.info('Device %s has IP %s', device.id, device.ip);

          this.emit('device-new', device);
        } catch (error) {
          this.log.error('%s was unable to be found. Please try using a static IP in your config.json.', device.id);
          this.emit('device-offline', {id: device.id});
        }
      }
    }
  }
}

module.exports = TuyaDiscover;
