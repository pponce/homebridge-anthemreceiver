const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { chromium } = require('playwright');
let browser, server, url;
before(async () => {
  const root = path.resolve(__dirname, '../homebridge-ui/public');
  server = http.createServer((req, res) => {
    const filename = path.join(root, req.url === '/' ? 'index.html' : path.basename(req.url));
    res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html');
    try { res.end(fs.readFileSync(filename)); } catch { res.writeHead(404); res.end(); }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function pageFor(t, config, viewport = { width: 1100, height: 1100 }) {
  const page = await browser.newPage({ viewport });
  t.after(() => page.close());
  const errors = []; page.on('pageerror', error => errors.push(error));
  await page.addInitScript(saved => {
    window.saved = saved; window.staged = null; window.saveEnabled = false; window.calls = [];
    window.homebridge = {
      getPluginConfig: async () => saved,
      updatePluginConfig: async value => { window.staged = structuredClone(value); },
      disableSaveButton: () => { window.saveEnabled = false; },
      enableSaveButton: () => { window.saveEnabled = true; },
      request: async (route, value) => {
        window.calls.push({ route, value });
        if (route === '/validate') {
          await new Promise(resolve => setTimeout(resolve, value.Host === 'slow' ? 150 : 5));
          return value.Host && value.Host !== 'invalid' ? { valid: true } : { valid: false, error: 'Invalid host' };
        }
        if (route === '/test-connection') return { ok: true, receiver: {
          model: 'MRX SLM', firmware: '1.0.0', serial: 'TEST', checkedAt: new Date().toISOString(), complete: true,
          capabilities: { model: 'MRX SLM', zones: 1, brightness: true, volume: true, dolby: true, directListeningMode: true },
          zones: [{ number: 1, power: false, mute: null, volume: null, input: null }], inputs: [{ number: 1, name: '<script>name</script>' }]
        } };
        return { ok: true };
      }
    };
  }, config);
  await page.goto(url); await page.locator('#settings').waitFor({ state: 'visible' });
  t.after(() => assert.deepEqual(errors, []));
  return page;
}

test('new configuration requires address and stages only after validation', async t => {
  const page = await pageFor(t, []);
  assert.equal(await page.evaluate(() => saveEnabled), false);
  await page.getByLabel('Receiver IP address or hostname').fill('receiver');
  await page.waitForFunction(() => saveEnabled);
  assert.equal(await page.evaluate(() => staged[0].Host), 'receiver');
  assert.equal(await page.evaluate(() => saved.length), 0);
  await page.getByLabel('TCP port').fill('0');
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => saveEnabled), false);
});
test('opening and editing existing config preserves metadata and omitted sections', async t => {
  const page = await pageFor(t, [{ platform: 'AnthemReceiver', Host: 'receiver', MaxVolumeDB: 0, Zone1: { Power: false }, _bridge: { username: 'AA:BB' }, custom: 42 }]);
  await page.waitForFunction(() => saveEnabled);
  const saved = await page.evaluate(() => staged[0]);
  assert.equal(saved.Zone2, undefined); assert.equal(saved.Zone1.Power, false); assert.equal(saved.MaxVolumeDB, 0);
  assert.equal(saved.custom, 42); assert.equal(saved._bridge.username, 'AA:BB');
  assert.equal(await page.evaluate(() => calls.some(call => call.route === '/test-connection')), false);
});
test('a slow response cannot enable Save for newer invalid settings', async t => {
  const page = await pageFor(t, [{ platform: 'AnthemReceiver', Host: 'receiver' }]);
  await page.waitForFunction(() => saveEnabled);
  await page.getByLabel('Receiver IP address or hostname').fill('slow');
  await page.waitForTimeout(210);
  await page.getByLabel('Receiver IP address or hostname').fill('invalid');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => saveEnabled), false);
  assert.equal(await page.locator('#message').textContent(), 'Invalid host');
});
test('connection preview applies model capabilities without deleting saved choices', async t => {
  const page = await pageFor(t, [{ platform: 'AnthemReceiver', Host: 'receiver', Zone2: { Active: true } }], { width: 390, height: 1000 });
  await page.waitForFunction(() => saveEnabled);
  await page.getByRole('button', { name: 'Test connection', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('field-Zone2-Active').disabled);
  assert.equal(await page.evaluate(() => staged[0].Zone2.Active), true);
  assert.ok((await page.locator('#preview').textContent()).includes('Unknown'));
  assert.equal(await page.locator('#preview script').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (process.env.ANTHEM_UI_SCREENSHOT) await page.screenshot({ path: process.env.ANTHEM_UI_SCREENSHOT, fullPage: true });
});
