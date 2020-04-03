#!/usr/bin/env node

const Proxy = require('http-mitm-proxy');
const EventEmitter = require('events');
const program = require('commander');
const QRCode = require('qrcode');
const path = require('path');
const os = require('os');
const JSON5 = require('json5');
const fs = require('fs-extra');

// Disable debug messages from the proxy
try {
    require('debug').disable();
} catch(ex) {}

const ROOT = path.resolve(__dirname);

const pemFile = path.join(ROOT, 'certs', 'ca.pem');

let localIPs = [];
const ifaces = os.networkInterfaces();
Object.keys(ifaces).forEach(name => {
    ifaces[name].forEach(network => {
        if (network.family === 'IPv4' && !network.internal) localIPs.push(network.address);
    });
});

const proxy = Proxy();
const emitter = new EventEmitter();

program
    .name('tuya-lan find')
    .option('--ip <ip>', 'IP address to listen for requests')
    .option('-p, --port <port>', 'port the proxy should listen on', 8060)
    .option('--schema', 'include schema in the output')
    .parse(process.argv);


if (program.ip) {
    if (localIPs.includes(program.ip)) localIPs = [program.ip];
    else {
        console.log(`The requested IP, ${program.ip}, is not a valid external IPv4 address. The valid options are:\n\t${localIPs.join('\n\t')}`);
        process.exit();
    }
}
if (localIPs.length > 1) {
    console.log(`You have multiple network interfaces: ${localIPs.join(', ')}\nChoose one by passing it with the --ip parameter.\n\nExample: tuya-lan-find --ip ${localIPs[0]}`);
    process.exit();
}
const localIPPorts = localIPs.map(ip => `${ip}:${program.port}`);

const escapeUnicode = str => str.replace(/[\u00A0-\uffff]/gu, c => "\\u" + ("000" + c.charCodeAt().toString(16)).slice(-4));

proxy.onError(function(ctx, err) {
    switch (err.code) {
        case 'ERR_STREAM_DESTROYED':
        case 'ECONNRESET':
            return;

        case 'ECONNREFUSED':
            console.error('Failed to intercept secure communications. This could happen due to bad CA certificate.');
            return;

        case 'EACCES':
            console.error(`Permission was denied to use port ${program.port}.`);
            return;

        default:
            console.error('Error:', err.code, err);
    }
});

proxy.onRequest(function(ctx, callback) {
    if (ctx.clientToProxyRequest.method === 'GET' && ctx.clientToProxyRequest.url === '/cert' && localIPPorts.includes(ctx.clientToProxyRequest.headers.host)) {
        ctx.use(Proxy.gunzip);
        console.log('Intercepted certificate request');

        ctx.proxyToClientResponse.writeHeader(200, {
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=0',
            'Content-Type': 'application/x-x509-ca-cert',
            'Content-Disposition': 'attachment; filename=cert.pem',
            'Content-Transfer-Encoding': 'binary',
            'Content-Length': fs.statSync(pemFile).size,
            'Connection': 'keep-alive',
        });
        //ctx.proxyToClientResponse.end(fs.readFileSync(path.join(ROOT, 'certs', 'ca.pem')));
        ctx.proxyToClientResponse.write(fs.readFileSync(pemFile));
        ctx.proxyToClientResponse.end();

        return;

    } else if (ctx.clientToProxyRequest.method === 'POST' && /tuya/.test(ctx.clientToProxyRequest.headers.host)) {
        ctx.use(Proxy.gunzip);

        ctx.onRequestData(function(ctx, chunk, callback) {
            return callback(null, chunk);
        });
        ctx.onRequestEnd(function(ctx, callback) {
            callback();
        });

        let chunks = [];
        ctx.onResponseData(function(ctx, chunk, callback) {
            chunks.push(chunk);
            return callback(null, chunk);
        });
        ctx.onResponseEnd(function(ctx, callback) {
            emitter.emit('tuya-config', Buffer.concat(chunks).toString());
            callback();
        });
    }

    return callback();
});

emitter.on('tuya-config', body => {
    if (body.indexOf('tuya.m.my.group.device.list') === -1) return;
    console.log('Intercepted config from Tuya');
    let data;
    const fail = (msg, err) => {
        console.error(msg, err);
        process.exit(1);
    };
    try {
        data = JSON.parse(body);
    } catch (ex) {
        return fail('There was a problem decoding config:', ex);
    }
    if (!Array.isArray(data.result)) return fail('Couldn\'t find a valid result-set.');

    let devices = [];
    data.result.some(data => {
        if (data && data.a === 'tuya.m.my.group.device.list') {
            devices = data.result;
            return true;
        }
        return false;
    });

    if (!Array.isArray(devices)) return fail('Couldn\'t find a good list of devices.');

    console.log(`\nFound ${devices.length} device${devices.length === 1 ? '' : 's'}:`);

    const foundDevices = devices.map(device => {
        return {
            name: device.name,
            id: device.devId,
            key: device.localKey,
            pid: device.productId
        }
    });

    if (program.schema) {
        let schemas = [];
        data.result.some(data => {
            if (data && data.a === 'tuya.m.device.ref.info.my.list') {
                schemas = data.result;
                return true;
            }
            return false;
        });

        if (Array.isArray(schemas)) {
            const defs = {};
            schemas.forEach(schema => {
                if (schema.id && schema.schemaInfo) {
                    defs[schema.id] = {};
                    if (schema.schemaInfo.schema) defs[schema.id].schema = escapeUnicode(schema.schemaInfo.schema);
                    if (schema.schemaInfo.schemaExt && schema.schemaInfo.schemaExt !== '[]') defs[schema.id].extras = escapeUnicode(schema.schemaInfo.schemaExt);
                }
            });
            foundDevices.forEach(device => {
                if (defs[device.pid]) device.def = defs[device.pid];
            });
        } else console.log('Didn\'t find schema definitions. You will need to identify the data-points manually if this is a new device.');
    }

    foundDevices.forEach(device => {
        delete device.pid;
    });

    console.log(JSON5.stringify(foundDevices, '\n', 2));

    setTimeout(() => {
        process.exit(0);
    }, 5000);
});

proxy.listen({port: program.port, sslCaDir: ROOT}, err => {
    if (err) {
        console.error('Error starting proxy: ' + err);
        return setTimeout(() => {
            process.exit(0);
        }, 5000);
    }
    let {address, port} = proxy.httpServer.address();
    if (address === '::' || address === '0.0.0.0') address = localIPs[0];

    QRCode.toString(`http://${address}:${port}/cert`, {type: 'terminal'}, function(err, url) {
        console.log(url);
        console.log('\nFollow the instructions on https://github.com/AMoo-Miki/homebridge-tuya-lan/wiki/Setup-Instructions');
        console.log(`Proxy IP: ${address}`);
        console.log(`Proxy Port: ${port}\n\n`);
    })
});
