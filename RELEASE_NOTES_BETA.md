First independent Anthem Receiver Plus migration candidate.

- Separate `homebridge-anthemreceiver-plus` package, preserving the `AnthemReceiver` platform and existing accessory identifiers.
- Home app volume slider mapping to a configured receiver maximum.
- Modern settings UI with readable day/night themes and read-only connection preview.
- Buffered and validated replies, controlled reconnection, confirmed state changes, and corrected zone/input handling.
- Dedicated ALM None selection while preserving existing listening-mode switches.
- Homebridge 1/2 and Node 22/24 CI, package-install checks, and a real-Homebridge migration regression with synthetic pairing records.

Existing users should read [MIGRATION.md](https://github.com/pponce/homebridge-anthemreceiver-plus/blob/main/MIGRATION.md) before replacing the old package. The old and new packages should not both load for the same receiver. Host-level migration tests do not guarantee preservation of every Apple Home scene; real receiver and Home app validation remain part of the beta.

Not yet Homebridge verified. STR preamplifier support is not included. Based on the original EHylands plugin and subsequent contributions; see ACKNOWLEDGEMENTS.md and LICENSE.

