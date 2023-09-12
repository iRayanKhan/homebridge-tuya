#!/usr/bin/env node

const YAML = require('yaml');
const fs = require('fs-extra');
const path = require('path');
const program = require('commander');
const crypto = require('crypto');
const readline = require('readline');
const async = require('async');

let file;

program
    .name('tuya-lan decode')
    .option('--key <key>', 'device key')
    .option('--use <version>', 'override version string', '3.3')
    .arguments('<file>')
    .action(loc => {
        file = loc;
    })
    .parse(process.argv);

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

const decodeLine = (key, input, log = true) => {
    const encoding = (input.substr(0, 8) === '000055aa') ? 'hex' : 'base64';

    let buffer = Buffer.from(input, encoding);
    const raw = Buffer.from(input, encoding);
    const len = buffer.length;
    if (buffer.readUInt32BE(0) !== 0x000055aa || buffer.readUInt32BE(len - 4) !== 0x0000aa55) {
        console.log("*** Input doesn't match the expected signature:", buffer.readUInt32BE(0).toString(16).padStart(8, '0'), buffer.readUInt32BE(len - 4).toString(16).padStart(8, '0'));
        return rl.prompt();
    }

    // Try 3.3
    const size = buffer.readUInt32BE(12);
    const cmd = buffer.readUInt32BE(8);
    const seq = buffer.readUInt32BE(4);
    const crcIn = buffer.readInt32BE(len - 8);
    const preHash = buffer.slice(0, len - 8);
    if (log) {
        console.log(`Cmd > ${cmd}  \tLen > ${len}\tSize > ${size}\tSeq > ${seq}`);
        console.log(`CRC > \t${crcIn === getCRC32(preHash) ? `Pass` : `Fail ${crcIn} ≠ ${getCRC32(preHash)}`}`);
    }
    const flag = buffer.readUInt32BE(16) & 0xFFFFFF00;
    buffer = buffer.slice(len - size + (flag ? 0 : 4), len - 8);
    if (buffer.indexOf(program.use || '3.3') !== -1) buffer = buffer.slice(15 + buffer.indexOf(program.use || '3.3'));
    else if (buffer.indexOf('3.2') !== -1) buffer = buffer.slice(15 + buffer.indexOf('3.2'));

    switch (cmd) {
        case 7:
        case 8:
        case 10:
        case 13:
        case 16:
            if (buffer.length === 0) {
                console.log(`${('' + seq).padEnd(4)} Decoded ${cmd}> Empty`);
                break;
            }
            try {
                const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
                let decryptedMsg = decipher.update(buffer, 'buffer', 'utf8');
                decryptedMsg += decipher.final('utf8');

                console.log(`${('' + seq).padEnd(4)} Decoded ${cmd}>`, decryptedMsg);
                if (log) console.log(`${('' + seq).padEnd(4)} Raw ${cmd}>`, raw.toString('hex'));
            } catch (ex) {
                console.log(`${('' + seq).padEnd(4)}*Failed ${cmd}>`, raw.toString('hex'));
            }
            break;

        case 9:
            console.log(`${('' + seq).padEnd(4)} Decoded ${cmd}>`, flag ? 'Ping' : 'Pong');
            break;

        case 19:
            let decryptedMsg;
            try {
                const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
                decryptedMsg = decipher.update(buffer, 'buffer', 'utf8');
                decryptedMsg += decipher.final('utf8');
            } catch (ex) {
                decryptedMsg = '';
            }

            if (!decryptedMsg) {
                try {
                    const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from('6c1ec8e2bb9bb59ab50b0daf649b410a', 'hex'), '');
                    decryptedMsg = decipher.update(buffer, 'buffer', 'utf8');
                    decryptedMsg += decipher.final('utf8');
                } catch (ex) {
                    decryptedMsg = '';
                }
            }

            if (!decryptedMsg) decryptedMsg = buffer.toString('utf8');

            try {
                JSON.parse(decryptedMsg);
                console.log(`${('' + seq).padEnd(4)} Decoded ${cmd}>`, decryptedMsg);
                if (log) console.log(`${('' + seq).padEnd(4)} Raw ${cmd}>`, raw.toString('hex'));
            } catch (ex) {
                console.log(`${('' + seq).padEnd(4)}*Failed ${cmd}>`, raw.toString('hex'));
            }
            break;

        default:
            console.log(`Unknown ${cmd}>`, raw.toString('hex'));
    }
};

async.auto({
    Key: next => {
        if (program.key) return next(null, program.key);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '\nEnter the device key: ',
            crlfDelay: Infinity
        });

        rl.prompt();

        rl.on('line', line => {
            const input = line.trim();
            if (!input) return rl.prompt();

            rl.close();
            next(null, input);
        });
    },
    File: ['Key', (data, next) => {
        if (!file) return next();
        let content;
        try {
            content = fs.readFileSync(path.resolve(file), 'utf8');
        } catch (ex) {
            console.error('Filed to read the file');
            console.log(ex);
            return next(true);
        }

        const packets = YAML.parseDocument(content);
        if (Array.isArray(packets.errors) && packets.errors.length > 0) {
            packets.errors.forEach(console.error);
            return next(true);
        }

        const rows = packets.toJSON();

        Object.keys(rows).forEach(key => {
            decodeLine(data.Key, rows[key].replace(/\n/g, ''), false);
        });

        next();
    }],
    Line: ['File', (data, next) => {
        if (file) return next();

        console.log('\n\n*** Hit Ctrl+C or key in "exit" to end ***');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '\nEnter the encrypted message: ',
            crlfDelay: Infinity
        });

        rl.prompt();

        rl.on('line', line => {
            const input = line.trim();
            if (input.toLowerCase() === 'exit') process.exit(0);

            decodeLine(data.Key, input);

            rl.prompt();
        }).on('close', () => {
            process.exit(0);
        });
    }]
});
