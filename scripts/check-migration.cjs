'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const result = spawnSync(process.execPath, ['--test', 'test/migration.homebridge.cjs'], { encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
if (result.status && process.env.GITHUB_ACTIONS) {
  const report = (result.stdout || '') + (result.stderr || '');
  const error = report.match(/error: ([\s\S]*?)(?:\n\s+(?:code|stack|operator|expected):|$)/);
  const diagnostic = (error ? error[1] : report.slice(-500)).replace(/[\r\n]+/g, ' ').slice(0, 500);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `diagnostic=${diagnostic}\n`);
  const detail = ((result.stdout || '') + (result.stderr || '')).slice(-10000)
    .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.log(`::error title=Homebridge migration regression::${detail}`);
}
process.exitCode = result.status ?? 1;
