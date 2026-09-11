'use strict';
const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const { normalizeConfig } = require('../dist/config');
const { ConnectionTester } = require('../dist/ui-test');

class AnthemUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();
    const tester = new ConnectionTester();
    this.onRequest('/validate', config => {
      try { normalizeConfig(config); return { valid: true }; }
      catch (error) { return { valid: false, error: error instanceof Error ? error.message : 'Invalid receiver settings' }; }
    });
    this.onRequest('/test-connection', async config => {
      try { return { ok: true, receiver: await tester.test(config) }; }
      catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Connection test failed' }; }
    });
    this.onRequest('/cancel-test', () => { tester.stop(); return { ok: true }; });
    process.once('disconnect', () => tester.stop());
    this.ready();
  }
}
new AnthemUiServer();
