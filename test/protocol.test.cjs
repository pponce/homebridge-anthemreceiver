const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ResponseFramer, validateReply } = require('../dist/protocol.js');
const { normalizeConfig } = require('../dist/config.js');
const { capabilities } = require('../dist/capabilities.js');

test('every split boundary preserves receiver replies, including UTF-8 names', () => {
  const bytes = Buffer.from('Z1MUT1;IS10INCinéma;IS10ARC1;');
  for (let split = 1; split < bytes.length; split++) {
    const framer = new ResponseFramer();
    assert.deepEqual([...framer.push(bytes.subarray(0, split)), ...framer.push(bytes.subarray(split))], ['Z1MUT1', 'IS10INCinéma', 'IS10ARC1']);
  }
});
test('framer retains partial suffix, bounds memory, and resets decoder', () => {
  const framer = new ResponseFramer(10);
  assert.deepEqual(framer.push(Buffer.from('Z1MUT1;Z1')), ['Z1MUT1']);
  assert.deepEqual(framer.push(Buffer.from('POW0;')), ['Z1POW0']);
  assert.throws(() => framer.push(Buffer.alloc(11, 65)), /buffer/);
  assert.deepEqual(framer.push(Buffer.from('Z1MUT0;')), ['Z1MUT0']);
});
test('invalid fields cannot become array lengths or HomeKit values', () => {
  for (const reply of ['ICNfoo', 'ICN0', 'ICN99999', 'Z1POW2', 'Z1PVOLNaN', 'Z1VOL999', 'IS99ARC1', 'IS10ARC9']) {
    assert.throws(() => validateReply(reply), undefined, reply);
  }
  for (const reply of ['ICN64', 'Z1VOL-45.5', 'IS10ARC1', 'IS10DV2', 'Z1ALM14']) assert.doesNotThrow(() => validateReply(reply));
});
test('normalization supplies safe defaults without mutating saved config', () => {
  const config = { platform: 'AnthemReceiver', Host: ' 192.168.1.2 ', MaxVolumeDB: 0, Zone1: { Power: false }, _bridge: { username: 'AA:BB' }, extension: 42 };
  const before = JSON.stringify(config);
  const parsed = normalizeConfig(config);
  assert.equal(parsed.Port, 14999);
  assert.equal(parsed.Host, '192.168.1.2');
  assert.equal(parsed.MaxVolumeDB, 0);
  assert.equal(parsed.Zone1.Power, false);
  assert.equal(parsed.Zone2.Active, false);
  assert.equal(JSON.stringify(config), before);
  assert.equal(normalizeConfig(undefined, false).Host, '');
});
test('configuration rejects malformed sections and nonfinite settings', () => {
  for (const input of [{ Port: 0 }, { Port: '14999' }, { MaxVolumeDB: NaN }, { Zone1: null }, { Zone2: [] }, { Zone1: { Power: 'false' } }, { Host: 'http://receiver' }]) {
    assert.throws(() => normalizeConfig({ Host: 'receiver', ...input }));
  }
});
test('capabilities retain older receivers and restrict SLM', () => {
  assert.equal(capabilities('MRX 740 ').zones, 2);
  assert.equal(capabilities('MRX SLM').zones, 1);
  assert.equal(capabilities('MRX 710').protocol, 1);
  assert.equal(capabilities('MRX 710').directListeningMode, false);
  assert.throws(() => capabilities('New unknown receiver'), /Unsupported/);
});
