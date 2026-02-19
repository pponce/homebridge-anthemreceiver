# Homebridge 2 Deprecated API Audit

This repository was reviewed for common long-deprecated Homebridge/HAP-NodeJS APIs removed in Homebridge 2.

## Checked patterns

- `BatteryService` (replaced by `Battery`)
- `Characteristic.Units`, `Characteristic.Formats`, `Characteristic.Perms`
- `Characteristic.getValue()`
- `Accessory.getServiceByUUIDAndSubType()`
- `Accessory.updateReachability()`
- `Accessory.setPrimaryService()`
- legacy `init()`
- `Core` / `BridgeCore` references
- `storagePath` APIs
- legacy camera APIs (`AudioCodec`, `VideoCodec`, `StreamAudioParams`, `StreamVideoParams`, `cameraSource`, etc.)
- `useLegacyAdvertiser`
- `AccessoryLoader`
- misnamed `PROGRAM_SCHEDULED_MANUAL_MODE_` enum usage

## Findings

No usages of the removed APIs above were found in `src/`.

## Compatibility updates applied

- Platform registration uses the explicit plugin registration signature:
  - `api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, AnthemReceiverHomebridgePlatform)`
- Callback-based `.on('set', ...)` handling for TV remote key was migrated to `.onSet(...)`.
- Callback-based volume set handler was migrated to modern promise/void style setter.
- `package.json` engines + peer dependency now declare Homebridge v2-compatible ranges and Node 20+ runtime.

## Notes

- Lint currently reports pre-existing issues in files unrelated to this migration.
- Build succeeds.
