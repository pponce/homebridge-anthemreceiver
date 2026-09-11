const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { AnthemController } = require('../dist/AnthemController.js');
const { fakeReceiver } = require('./fake-receiver.cjs');
const { CommandTransactions } = require('../dist/transactions.js');
const timing = { connect: 1000, handshake: 1000, idle: 3000, keepalive: 2000, reconnect: 25, maxReconnect: 50, command: 300 };

async function ready(t, options = {}) {
  const receiver = await fakeReceiver(options);
  const controller = new AnthemController(timing);
  controller.AddControllingZone(1, 'Zone 1', true);
  controller.on('ControllerError', () => {});
  t.after(async () => { controller.Stop(); await receiver.close(); });
  const started = once(controller, 'ControllerReadyForOperation', { signal: AbortSignal.timeout(2500) });
  controller.Connect('127.0.0.1', receiver.port); await started;
  return { receiver, controller };
}

test('initial handshake and command confirmation over a real TCP socket', async t => {
  const { receiver, controller } = await ready(t);
  assert.equal(controller.IsReady(), true);
  assert.equal(controller.GetInputs().length, 12);
  await controller.RunCommand(() => controller.PowerZone(1, true));
  assert.equal(controller.GetZonePower(1), true);
  await controller.RunCommand(() => controller.SetMute(1, true));
  assert.equal(controller.GetMute(1), true);
  assert.ok(receiver.commands.includes('Z1MUT?'));
  await controller.RunCommand(() => controller.SetZoneInput(1, 10));
  assert.equal(controller.GetZone(1).GetActiveInput(), 10);
});
test('clean socket close reconnects once and refreshes state', async t => {
  const { receiver, controller } = await ready(t);
  const resumed = once(controller, 'ControllerReadyForOperation', { signal: AbortSignal.timeout(2500) });
  for (const socket of receiver.sockets) socket.end();
  await resumed;
  assert.equal(receiver.connections, 2);
  assert.equal(controller.IsReady(), true);
  controller.Stop();
  await assert.rejects(controller.RunCommand(() => controller.PowerZone(1, true)), /ready/);
});
test('multi-digit ARC and Dolby replies update the selected zone', async t => {
  const { controller } = await ready(t);
  controller.GetZone(1).SetActiveInput(10);
  const arc = once(controller, 'ZoneARCEnabledChange');
  const dolby = once(controller, 'ZoneDolbyPostProcessingChange');
  controller.AnalyseResponse(Buffer.from('IS10ARC1;IS10DV2;'));
  assert.deepEqual(await arc, [1, true]);
  assert.deepEqual(await dolby, [1, 2]);
});
test('malformed count is logged and cannot escape parser callback', async t => {
  const { controller } = await ready(t);
  const before = controller.GetInputs().length;
  assert.doesNotThrow(() => controller.AnalyseResponse(Buffer.from('ICNfoo;ICN999999;')));
  assert.equal(controller.GetInputs().length, before);
});
test('older protocol handshake and SLM names remain supported', async t => {
  for (const model of ['MRX 710', 'MRX SLM']) {
    const { controller } = await ready(t, { model });
    assert.equal(controller.ReceiverModel, model);
    assert.equal(controller.GetInputs()[0], 'Cinema');
  }
});
test('pending and queued commands fail on disconnect without replay', async () => {
  let sent = 0;
  const queue = new CommandTransactions(async () => { sent++; }, () => true, 100);
  const a = queue.run(() => ['Z1MUT1']);
  const b = queue.run(() => ['Z1POW1']);
  const settled = Promise.allSettled([a, b]);
  await new Promise(resolve => setImmediate(resolve));
  queue.disconnect();
  assert.deepEqual((await settled).map(result => result.status), ['rejected', 'rejected']);
  assert.equal(sent, 1);
});
test('timeout and receiver rejection propagate to caller', async () => {
  const queue = new CommandTransactions(async () => {}, () => true, 20);
  await assert.rejects(queue.run(() => ['Z1MUT1']), /confirm/);
  const action = queue.run(() => ['Z1POW1']);
  const rejected = assert.rejects(action, /rejected/);
  await new Promise(resolve => setImmediate(resolve));
  queue.receive('!EZ1POW1'); await rejected;
});
