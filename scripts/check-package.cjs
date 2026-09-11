'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const result = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (result.status) throw new Error(result.stderr || 'npm pack failed');
const files = new Set(JSON.parse(result.stdout)[0].files.map(file => file.path));
for (const name of fs.readdirSync('dist').filter(name => name.endsWith('.js'))) {
  if (!files.has(`dist/${name}`)) throw new Error(`Missing runtime module: dist/${name}`);
}
for (const name of ['dist/index.js', 'config.schema.json', 'homebridge-ui/server.js', 'homebridge-ui/public/index.html', 'homebridge-ui/public/app.js', 'homebridge-ui/public/style.css']) {
  if (!files.has(name)) throw new Error(`Missing packaged file: ${name}`);
}
if (typeof require('../dist/index.js') !== 'function') throw new Error('Plugin registration entry point did not load');
console.log(`Package content and entry point verified (${files.size} files).`);
