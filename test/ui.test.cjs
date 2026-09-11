const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConnectionTester } = require('../dist/ui-test.js');
const { fakeReceiver } = require('./fake-receiver.cjs');
const model = require('../homebridge-ui/public/model.js');

test('editing preserves unrelated blocks, metadata, omissions, and false/zero', () => {
  const input = [{ platform: 'Other', x: 1 }, { platform: 'AnthemReceiver', Host: 'receiver', Zone1: { Power: false }, MaxVolumeDB: 0, _bridge: { username: 'AA:BB' }, custom: 12 }];
  const { blocks, config, index } = model.load(input);
  assert.equal(index, 1);
  config.Host = 'new-receiver';
  assert.deepEqual(blocks[0], input[0]);
  assert.deepEqual(config._bridge, input[1]._bridge);
  assert.equal(config.Zone1.Power, false);
  assert.equal(config.MaxVolumeDB, 0);
  assert.equal(config.Zone2, undefined);
  assert.equal(input[1].Host, 'receiver');
});
test('duplicate platforms and malformed zones fail without replacing config', () => {
  assert.throws(() => model.load([{ platform: 'AnthemReceiver' }, { platform: 'AnthemReceiver' }]), /More than one/);
  assert.throws(() => model.load([{ platform: 'AnthemReceiver', Zone2: [] }]), /object/);
});
test('diagnostic reads identity/status without any write commands', async t => {
  const receiver = await fakeReceiver();
  const tester = new ConnectionTester(500, 0);
  t.after(async () => { tester.stop(); await receiver.close(); });
  const result = await tester.test({ Host: '127.0.0.1', Port: receiver.port });
  assert.equal(result.model, 'MRX 740');
  assert.equal(result.complete, true);
  assert.equal(result.inputs.length, 12);
  assert.equal(result.zones[0].power, false);
  assert.equal(result.zones[0].volume, null);
  assert.ok(receiver.commands.length > 1);
  assert.ok(receiver.commands.every(command => command.endsWith('?')));
});
test('diagnostic cancels and releases concurrency guard', async t => {
  const receiver = await fakeReceiver({ ignore: () => true });
  const tester = new ConnectionTester(100, 0);
  t.after(async () => { tester.stop(); await receiver.close(); });
  const pending = tester.test({ Host: '127.0.0.1', Port: receiver.port });
  const rejected = assert.rejects(pending, /cancelled/);
  await assert.rejects(tester.test({ Host: '127.0.0.1', Port: receiver.port }), /already/);
  tester.stop(); await rejected;
  await assert.rejects(tester.test({ Host: '127.0.0.1', Port: receiver.port }), /No supported/);
});
