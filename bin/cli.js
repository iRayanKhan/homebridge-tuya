#!/usr/bin/env node

const program = require('commander');
const path = require('path');
const fs = require('fs-extra');

const ROOT = path.resolve(__dirname);

program
    .version('v' + fs.readJSONSync(path.join(ROOT, '../package.json')).version, '-v, --version', 'output package version')
    .command('decode', 'decode a file or packet')
    .command('find', 'find device id and key combinations', {isDefault: true})
    .parse(process.argv);