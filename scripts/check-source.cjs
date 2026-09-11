'use strict';
const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) check(path);
    else if (/\.(?:cjs|js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status) process.exit(result.status);
    }
  }
}
check('scripts');
check('homebridge-ui');
