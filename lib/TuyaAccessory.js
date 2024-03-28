const net = require('net');
const async = require('async');
const crypto = require('crypto');
const EventEmitter = require('events');

const isNonEmptyPlainObject = o => {
    if (!o) return false;
    for (let i in o) return true;
    return false;
};

class TuyaAccessory extends EventEmitter {
    constructor(props) {
        super();

        if (!(props.id && props.key && props.ip) && !props.fake) return this.log.info('Insufficient details to initialize:', props);

        this.log = props.log;

        this.context = {version: '3.1', port: 6668, ...props};

        this.state = {};
        this._cachedBuffer = Buffer.allocUnsafe(0);

        this._msgQueue = async.queue(this[this.context.version < 3.2 ? '_msgHandler_3_1' : this.context.version === '3.4' ? '_msgHandler_3_4' : '_msgHandler_3_3'].bind(this), 1);

        if (this.context.version >= 3.2) {
            this.context.pingGap = Math.min(this.context.pingGap || 9, 9);
            //this.log.info(`Changing ping gap for ${this.context.name} to ${this.context.pingGap}s`);
        }

        this.connected = false;
        if (props.connect !== false) this._connect();

        this._connectionAttempts = 0;
        this._sendCounter = 0;

        this._tmpLocalKey = null;
        this._tmpRemoteKey = null;
        this.session_key = null;
    }

    _connect() {
        if (this.context.fake) {
            this.connected = true;
            return setTimeout(() => {
                this.emit('change', {}, this.state);
            }, 1000);
        }

        this._socket = net.Socket();

        this._incrementAttemptCounter();

        (this._socket.reconnect = () => {
            //this.log.debug(`reconnect called for ${this.context.name}`);
            if (this._socket._pinger) {
                clearTimeout(this._socket._pinger);
                this._socket._pinger = null;
            }

            if (this._socket._connTimeout) {
                clearTimeout(this._socket._connTimeout);
                this._socket._connTimeout = null;
            }

            if (this._socket._errorReconnect) {
                clearTimeout(this._socket._errorReconnect);
                this._socket._errorReconnect = null;
            }

            this._socket.setKeepAlive(true);
            this._socket.setNoDelay(true);

            this._socket._connTimeout = setTimeout(() => {
                this._socket.emit('error', new Error('ERR_CONNECTION_TIMED_OUT'));
                //this._socket.destroy();
                //process.nextTick(this._connect.bind(this));
            }, (this.context.connectTimeout || 30) * 1000);

            this._incrementAttemptCounter();

            this._socket.connect(this.context.port, this.context.ip);
        })();

        this._socket._ping = () => {
            if (this._socket._pinger) clearTimeout(this._socket._pinger);
            this._socket._pinger = setTimeout(() => {
                //Retry ping
                this._socket._pinger = setTimeout(() => {
                    this._socket.emit('error', new Error('ERR_PING_TIMED_OUT'));
                }, 5000);

                this._send({
                    cmd: 9
                });
            }, (this.context.pingTimeout || 30) * 1000);

            this._send({
                cmd: 9
            });
        };

        this._socket.on('connect', () => {
            if (this.context.version !== '3.4') {
                clearTimeout(this._socket._connTimeout);

                this.connected = true;
                this.emit('connect');
                if (this._socket._pinger)
                    clearTimeout(this._socket._pinger);
                this._socket._pinger = setTimeout(() => this._socket._ping(), 1000);

                if (this.context.intro === false) {
                    this.emit('change', {}, this.state);
                    process.nextTick(this.update.bind(this));
                }
            }
        });

        this._socket.on('ready', () => {
            if (this.context.intro === false) return;
            this.connected = true;

            if (this.context.version === '3.4') {
                this._tmpLocalKey = crypto.randomBytes(16);
                const payload = {
                    data: this._tmpLocalKey,
                    encrypted: true,
                    cmd: 3 //CommandType.BIND
                }
                this._send(payload);
            } else {
                this.update();
            }
        });

        this._socket.on('data', msg => {
            this._cachedBuffer = Buffer.concat([this._cachedBuffer, msg]);

            do {
                let startingIndex = this._cachedBuffer.indexOf('000055aa', 'hex');
                if (startingIndex === -1) {
                    this._cachedBuffer = Buffer.allocUnsafe(0);
                    break;
                }
                if (startingIndex !== 0) this._cachedBuffer = this._cachedBuffer.slice(startingIndex);

                let endingIndex = this._cachedBuffer.indexOf('0000aa55', 'hex');
                if (endingIndex === -1) break;

                endingIndex += 4;

                this._msgQueue.push({msg: this._cachedBuffer.slice(0, endingIndex)});

                this._cachedBuffer = this._cachedBuffer.slice(endingIndex);
            } while (this._cachedBuffer.length);
        });

        this._socket.on('error', err => {
            this.connected = false;
            this.log.info(`Socket had a problem and will reconnect to ${this.context.name} (${err && err.code || err})`);

            if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE') && this._connectionAttempts < 10) {
                this.log.debug(`Reconnecting with connection attempts =  ${this._connectionAttempts}`);
                return process.nextTick(this._socket.reconnect.bind(this));
            }

            this._socket.destroy();

            let delay = 5000;
            if (err) {
                if (err.code === 'ENOBUFS') {
                    this.log.warn('Operating system complained of resource exhaustion; did I open too many sockets?');
                    this.log.info('Slowing down retry attempts; if you see this happening often, it could mean some sort of incompatibility.');
                    delay = 60000;
                } else if (this._connectionAttempts > 10) {
                    this.log.info('Slowing down retry attempts; if you see this happening often, it could mean some sort of incompatibility.');
                    delay = 60000;
                }
            }

            if (!this._socket._errorReconnect) {
                this.log.debug(`after error setting _connect in ${delay}ms`);
                this._socket._errorReconnect = setTimeout(() => {
                    this.log.debug(`executing _connect after ${delay}ms delay`);
                    process.nextTick(this._connect.bind(this));
                }, delay);
            }
        });

        this._socket.on('close', err => {
            this.connected = false;
            this.session_key = null;
            //this.log.info('Closed connection with', this.context.name);
        });

        this._socket.on('end', () => {
            this.connected = false;
            this.session_key = null;
            this.log.info('Disconnected from', this.context.name);
        });
    }

    _incrementAttemptCounter() {
        this._connectionAttempts++;
        setTimeout(() => {
            this.log.debug(`decrementing this._connectionAttempts, currently ${this._connectionAttempts}`);
            this._connectionAttempts--;
        }, 10000);
    }

    _msgHandler_3_1(task, callback) {
        if (!(task.msg instanceof Buffer)) return callback();

        const len = task.msg.length;
        if (len < 16 ||
            task.msg.readUInt32BE(0) !== 0x000055aa ||
            task.msg.readUInt32BE(len - 4) !== 0x0000aa55
        ) return callback();

        const size = task.msg.readUInt32BE(12);
        if (len - 8 < size) return callback();

        const cmd = task.msg.readUInt32BE(8);
        let data = task.msg.slice(len - size, len - 8).toString('utf8').trim().replace(/\0/g, '');

        if (this.context.intro === false && cmd !== 9)
            this.log.info('Message from', this.context.name + ':', data);

        switch (cmd) {
            case 7:
                // ignoring
                break;

            case 9:
                if (this._socket._pinger) clearTimeout(this._socket._pinger);
                this._socket._pinger = setTimeout(() => {
                    this._socket._ping();
                }, (this.context.pingGap || 20) * 1000);
                break;

            case 8:
                let decryptedMsg;
                try {
                    const decipher = crypto.createDecipheriv('aes-128-ecb', this.context.key, '');
                    decryptedMsg = decipher.update(data.substr(19), 'base64', 'utf8');
                    decryptedMsg += decipher.final('utf8');
                } catch(ex) {
                    decryptedMsg = data.substr(19).toString('utf8');
                }

                try {
                    data = JSON.parse(decryptedMsg);
                } catch (ex) {
                    data = decryptedMsg;
                    this.log.info(`Odd message from ${this.context.name} with command ${cmd}:`, data);
                    this.log.info(`Raw message from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
                    break;
                }

                if (data && data.dps) {
                    //this.log.info('Update from', this.context.name, 'with command', cmd + ':', data.dps);
                    this._change(data.dps);
                }
                break;

            case 10:
                if (data) {
                    if (data === 'json obj data unvalid') {
                        this.log.info(`${this.context.name} (${this.context.version}) didn't respond with its current state.`);
                        this.emit('change', {}, this.state);
                        break;
                    }

                    try {
                        data = JSON.parse(data);
                    } catch (ex) {
                        this.log.info(`Malformed update from ${this.context.name} with command ${cmd}:`, data);
                        this.log.info(`Raw update from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
                        break;
                    }

                    if (data && data.dps) this._change(data.dps);
                }
                break;

            default:
                this.log.info(`Odd message from ${this.context.name} with command ${cmd}:`, data);
                this.log.info(`Raw message from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
        }

        callback();
    }

    _msgHandler_3_3(task, callback) {
        if (!(task.msg instanceof Buffer)) return callback;

        const len = task.msg.length;
        if (len < 16 ||
            task.msg.readUInt32BE(0) !== 0x000055aa ||
            task.msg.readUInt32BE(len - 4) !== 0x0000aa55
        ) return callback();

        const size = task.msg.readUInt32BE(12);
        if (len - 8 < size) return callback();

        const cmd = task.msg.readUInt32BE(8);

        if (cmd === 7) return callback(); // ignoring
        if (cmd === 9) {
            if (this._socket._pinger) clearTimeout(this._socket._pinger);
            this._socket._pinger = setTimeout(() => {
                this._socket._ping();
            }, (this.context.pingGap || 20) * 1000);

            return callback();
        }

        let versionPos = task.msg.indexOf('3.3');
        if (versionPos === -1) versionPos = task.msg.indexOf('3.2');
        const cleanMsg = task.msg.slice(versionPos === -1 ? len - size + ((task.msg.readUInt32BE(16) & 0xFFFFFF00) ? 0 : 4) : 15 + versionPos, len - 8);

        let decryptedMsg;
        try {
            const decipher = crypto.createDecipheriv('aes-128-ecb', this.context.key, '');
            decryptedMsg = decipher.update(cleanMsg, 'buffer', 'utf8');
            decryptedMsg += decipher.final('utf8');
        } catch (ex) {
            decryptedMsg = cleanMsg.toString('utf8');
        }

        if (cmd === 10 && decryptedMsg === 'json obj data unvalid') {
            this.log.info(`${this.context.name} (${this.context.version}) didn't respond with its current state.`);
            this.emit('change', {}, this.state);
            return callback();
        }

        let data;
        try {
            data = JSON.parse(decryptedMsg);
        } catch(ex) {
            this.log.info(`Odd message from ${this.context.name} with command ${cmd}:`, decryptedMsg);
            this.log.info(`Raw message from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
            return callback();
        }

        switch (cmd) {
            case 8:
            case 10:
                if (data) {
                    if (data.dps) {
                        //this.log.info(`Heard back from ${this.context.name} with command ${cmd}`);
                        this._change(data.dps);
                    } else {
                        this.log.info(`Malformed message from ${this.context.name} with command ${cmd}:`, decryptedMsg);
                        this.log.info(`Raw message from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
                    }
                }
                break;

            default:
                this.log.info(`Odd message from ${this.context.name} with command ${cmd}:`, decryptedMsg);
                this.log.info(`Raw message from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
        }

        callback();
    }

    _msgHandler_3_4(task, callback) {
        if (!(task.msg instanceof Buffer)) return callback;

        const len = task.msg.length;
        if (len < 16 ||
          task.msg.readUInt32BE(0) !== 0x000055aa ||
          task.msg.readUInt32BE(len - 4) !== 0x0000aa55
        ) return callback();

        const size = task.msg.readUInt32BE(12);
        if (len - 8 < size) return callback();

        const cmd = task.msg.readUInt32BE(8);

        if (cmd === 7 || cmd === 13) return callback(); // ignoring
        if (cmd === 9) {
            if (this._socket._pinger) clearTimeout(this._socket._pinger);
            this._socket._pinger = setTimeout(() => {
                this._socket._ping();
            }, (this.context.pingGap || 20) * 1000);

            return callback();
        }

        let versionPos = task.msg.indexOf('3.4');
        const cleanMsg = task.msg.slice(versionPos === -1 ? len - size + ((task.msg.readUInt32BE(16) & 0xFFFFFF00) ? 0 : 4) : 15 + versionPos, len - 0x24);

        const expectedCrc = task.msg.slice(len - 0x24, task.msg.length - 4).toString('hex');
        const computedCrc = hmac(task.msg.slice(0, len - 0x24), this.session_key ?? this.context.key).toString('hex');

        if (expectedCrc !== computedCrc) {
            throw new Error(`HMAC mismatch: expected ${expectedCrc}, was ${computedCrc}. ${task.msg.toString('hex')}`);
        }

        let decryptedMsg;
        const decipher = crypto.createDecipheriv('aes-128-ecb', this.session_key ?? this.context.key, null);
        decipher.setAutoPadding(false)
        decryptedMsg = decipher.update(cleanMsg);
        decipher.final();
        //remove padding
        decryptedMsg = decryptedMsg.slice(0, (decryptedMsg.length - decryptedMsg[decryptedMsg.length-1]) )

        let parsedPayload;
        try {
            if (decryptedMsg.indexOf(this.context.version) === 0) {
                decryptedMsg = decryptedMsg.slice(15)
            }
            let res =  JSON.parse(decryptedMsg)
            if('data' in res) {
                let resdata = res.data
                resdata.t = res.t
                parsedPayload = resdata//res.data //for compatibility with tuya-mqtt
            } else {
                parsedPayload = res;
            }
        } catch (_) {
            parsedPayload = decryptedMsg;
        }

        if (cmd === 4) { // CommandType.RENAME_GW
            this._tmpRemoteKey = parsedPayload.subarray(0, 16);
            const calcLocalHmac =  hmac(this._tmpLocalKey, this.session_key ?? this.context.key).toString('hex')
            const expLocalHmac = parsedPayload.slice(16, 16 + 32).toString('hex')
            if (expLocalHmac !== calcLocalHmac) {
                throw new Error(`HMAC mismatch(keys): expected ${expLocalHmac}, was ${calcLocalHmac}. ${parsedPayload.toString('hex')}`);
            }
            const payload = {
                data: hmac(this._tmpRemoteKey, this.context.key),
                encrypted: true,
                cmd: 5 //CommandType.RENAME_DEVICE
            }
            this._send(payload);
            clearTimeout(this._socket._connTimeout);

            this.session_key = Buffer.from(this._tmpLocalKey)
            for( let i=0; i<this._tmpLocalKey.length; i++) {
                this.session_key[i] = this._tmpLocalKey[i] ^ this._tmpRemoteKey[i]
            }

            this.session_key = encrypt34(this.session_key, this.context.key);
            clearTimeout(this._socket._connTimeout);

            this.connected = true;
            this.update();
            this.emit('connect');
            if (this._socket._pinger)
                clearTimeout(this._socket._pinger);
            this._socket._pinger = setTimeout(() => this._socket._ping(), 1000);

            return callback();
        }

        if (cmd === 10 && parsedPayload === 'json obj data unvalid') {
            this.log.info(`${this.context.name} (${this.context.version}) didn't respond with its current state.`);
            this.emit('change', {}, this.state);
            return callback();
        }

        switch (cmd) {
            case 8:
            case 10:
            case 16:
                if (parsedPayload) {
                    if (parsedPayload.dps) {
                        //this.log.info(`Heard back from ${this.context.name} with command ${cmd}`);
                        this._change(parsedPayload.dps);
                    } else {
                        this.log.info(`Malformed message from ${this.context.name} with command ${cmd}:`, decryptedMsg);
                        this.log.info(`Raw message from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
                    }
                }
                break;

            default:
                this.log.info(`Odd message from ${this.context.name} with command ${cmd}:`, decryptedMsg);
                this.log.info(`Raw message from ${this.context.name} (${this.context.version}) with command ${cmd}:`, task.msg.toString('hex'));
        }

        callback();
    }

    update(o) {
        const dps = {};
        let hasDataPoint = false;
        o && Object.keys(o).forEach(key => {
            if (!isNaN(key)) {
                dps['' + key] = o[key];
                hasDataPoint = true;
            }
        });

        if (this.context.fake) {
            if (hasDataPoint) this._fakeUpdate(dps);
            return true;
        }

        let result = false;
        if (hasDataPoint) {
            //this.log.info(" Sending", this.context.name, JSON.stringify(dps));
            const t = (Date.now() / 1000).toFixed(0);
            const payload = {
                devId: this.context.id,
                uid: '',
                t,
                dps
            };
            const data = this.context.version === '3.4'
              ? {
                  data: {
                      ...payload,
                      ctype: 0,
                      t: undefined
                  },
                  protocol:5,
                  t
              }
              : payload
            result = this._send({
                data,
                cmd: this.context.version === '3.4' ? 13 : 7
            });
            if (result !== true) this.log.info(" Result", result);
            if (this.context.sendEmptyUpdate) {
                //this.log.info(" Sending", this.context.name, 'empty signature');
                this._send({cmd: this.context.version === '3.4' ? 13 : 7});
            }
        } else {
            //this.log.info(`Sending first query to ${this.context.name} (${this.context.version})`);
            result = this._send({
                data: {
                    gwId: this.context.id,
                    devId: this.context.id
                },
                cmd: this.context.version === '3.4' ? 16 : 10
            });
        }

        return result;
    }

    _change(data) {
        if (!isNonEmptyPlainObject(data)) return;

        const changes = {};
        Object.keys(data).forEach(key => {
            if (data[key] !== this.state[key]) {
                changes[key] = data[key];
            }
        });

        if (isNonEmptyPlainObject(changes)) {
            this.state = {...this.state, ...data};
            this.emit('change', changes, this.state);
        }
    }

    _send(o) {
        if (this.context.fake) return;
        if (!this.connected) return false;

        if (this.context.version < 3.2) return this._send_3_1(o);
        if (this.context.version === '3.3') return this._send_3_3(o);
        return this._send_3_4(o);
    }

    _send_3_1(o) {
        const {cmd, data} = {...o};

        let msg = '';

        //data
        if (data) {
            switch (cmd) {
                case 7:
                    const cipher = crypto.createCipheriv('aes-128-ecb', this.context.key, '');
                    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
                    encrypted += cipher.final('base64');

                    const hash = crypto.createHash('md5').update(`data=${encrypted}||lpv=${this.context.version}||${this.context.key}`, 'utf8').digest('hex').substr(8, 16);

                    msg = this.context.version + hash + encrypted;
                    break;

                case 10:
                    msg = JSON.stringify(data);
                    break;

            }
        }

        const payload = Buffer.from(msg);
        const prefix = Buffer.from('000055aa00000000000000' + cmd.toString(16).padStart(2, '0'), 'hex');
        const suffix = Buffer.concat([payload, Buffer.from('000000000000aa55', 'hex')]);

        const len = Buffer.allocUnsafe(4);
        len.writeInt32BE(suffix.length, 0);

        return this._socket.write(Buffer.concat([prefix, len, suffix]));
    }

    _send_3_3(o) {
        const {cmd, data} = {...o};

        // If sending empty dp-update command, we should not increment the sequence
        if (cmd !== 7 || data) this._sendCounter++;

        const hex = [
            '000055aa', //header
            this._sendCounter.toString(16).padStart(8, '0'), //sequence
            cmd.toString(16).padStart(8, '0'), //command
            '00000000' //size
        ];
        //version
        if (cmd === 7 && !data) hex.push('00000000');
        else if (cmd !== 9 && cmd !== 10) hex.push('332e33000000000000000000000000');
        //data
        if (data) {
            const cipher = crypto.createCipheriv('aes-128-ecb', this.context.key, '');
            let encrypted = cipher.update(Buffer.from(JSON.stringify(data)), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            hex.push(encrypted);
        }
        //crc32
        hex.push('00000000');
        //tail
        hex.push('0000aa55');

        const payload = Buffer.from(hex.join(''), 'hex');
        //length
        payload.writeUInt32BE(payload.length - 16, 12);
        //crc
        payload.writeInt32BE(getCRC32(payload.slice(0, payload.length - 8)), payload.length - 8);

        return this._socket.write(payload);
    }

    _fakeUpdate(dps) {
        this.log.info('Fake update:', JSON.stringify(dps));
        Object.keys(dps).forEach(dp => {
            this.state[dp] = dps[dp];
        });
        setTimeout(() => {
            this.emit('change', dps, this.state);
        }, 1000);
    }

    _send_3_4(o) {
        let {cmd, data} = {...o};

        //data
        if (!data) {
            data = Buffer.allocUnsafe(0);
        }
        if (!(data instanceof Buffer)) {
            if (typeof data !== 'string') {
                data = JSON.stringify(data);
            }

            data = Buffer.from(data);
        }

        if (cmd !== 10 &&
          cmd !== 9 &&
          cmd !== 16 &&
          cmd !== 3 &&
          cmd !== 5 &&
          cmd !== 18) {
            // Add 3.4 header
            // check this: mqc_very_pcmcd_mcd(int a1, unsigned int a2)
            const buffer = Buffer.alloc(data.length + 15);
            Buffer.from('3.4').copy(buffer, 0);
            data.copy(buffer, 15);
            data = buffer;
        }

        const padding=0x10 - (data.length & 0xf);
        let buf34 = Buffer.alloc((data.length + padding), padding);
        data.copy(buf34);
        data = buf34
        const encrypted = encrypt34(data, this.session_key ?? this.context.key)

        const encryptedBuffer = Buffer.from(encrypted);
        // Allocate buffer with room for payload + 24 bytes for
        // prefix, sequence, command, length, crc, and suffix
        const buffer = Buffer.alloc(encryptedBuffer.length + 52);
        // Add prefix, command, and length
        buffer.writeUInt32BE(0x000055AA, 0);
        buffer.writeUInt32BE(cmd, 8);
        buffer.writeUInt32BE(encryptedBuffer.length + 0x24, 12);

        // If sending empty dp-update command, we should not increment the sequence
        if ((cmd !== 7 && cmd !== 13) || data) {
            this._sendCounter++;
            buffer.writeUInt32BE(this._sendCounter, 4);
        }

        // Add payload, crc, and suffix
        encryptedBuffer.copy(buffer, 16);
        const calculatedCrc = hmac(buffer.slice(0, encryptedBuffer.length + 16), this.session_key ?? this.context.key);// & 0xFFFFFFFF;
        calculatedCrc.copy(buffer, encryptedBuffer.length + 16);
        buffer.writeUInt32BE(0x0000AA55, encryptedBuffer.length + 48);

        return this._socket.write(buffer);
    }
}

const encrypt34 = (data, encryptKey) => {
    const cipher = crypto.createCipheriv('aes-128-ecb', encryptKey, null);
    cipher.setAutoPadding(false);
    let encrypted = cipher.update(data);
    cipher.final();
    return encrypted;
}

const hmac = (data, hmacKey) => {
    return crypto.createHmac('sha256',hmacKey).update(data, 'utf8').digest();
}

const crc32LookupTable = [];
(() => {
    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 8; j > 0; j--) crc = (crc & 1) ? (crc >>> 1) ^ 3988292384 : crc >>> 1;
        crc32LookupTable.push(crc);
    }
})();

const getCRC32 = buffer => {
    let crc = 0xffffffff;
    for (let i = 0, len = buffer.length; i < len; i++) crc = crc32LookupTable[buffer[i] ^ (crc & 0xff)] ^ (crc >>> 8);
    return ~crc;
};


module.exports = TuyaAccessory;
