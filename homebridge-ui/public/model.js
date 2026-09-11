(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  function load(input) {
    if (!Array.isArray(input) || input.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('Unexpected Homebridge configuration. No settings were changed.');
    const blocks = clone(input);
    const indices = blocks.map((item, i) => item.platform === 'AnthemReceiver' ? i : -1).filter(i => i >= 0);
    if (indices.length > 1) throw new Error('More than one Anthem platform is configured. Resolve the duplicate in Homebridge JSON settings first.');
    let index = indices[0];
    if (index === undefined) {
      index = blocks.length;
      blocks.push({ platform: 'AnthemReceiver', Host: '', Port: 14999, Zone1: { Active: true, Power: true, Mute: true, Volume: true }, Zone2: {} });
    }
    const config = blocks[index];
    for (const key of ['Zone1', 'Zone2']) {
      if (config[key] !== undefined && (!config[key] || typeof config[key] !== 'object' || Array.isArray(config[key]))) throw new Error(`${key} must be an object. Correct the JSON configuration before editing.`);
    }
    return { blocks, index, config };
  }
  const api = { clone, load };
  if (typeof module !== 'undefined') module.exports = api;
  else root.AnthemConfig = api;
})(typeof window === 'undefined' ? globalThis : window);
