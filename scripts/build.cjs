'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
// Resolve the compiler before removing old output, so a missing compiler is explicit.
const compiler = require.resolve('typescript/bin/tsc');
fs.rmSync('dist', { recursive: true, force: true });
const result = spawnSync(process.execPath, [compiler], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
