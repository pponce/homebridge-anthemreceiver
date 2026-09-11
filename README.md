# homebridge-anthemreceiver
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm downloads](https://badgen.net/npm/dt/homebridge-anthemreceiver)](https://www.npmjs.com/package/homebridge-anthemreceiver)

Homebridge plugin for Anthem receivers.
- Zone 1 and Zone 2 Power/Input accessories (External accessories to be manually added in Home App)
- Zone 1 and Zone 2 Power, Volume, Mute, Input and Dolby Audio Processing accessories
- Zone 1 ARC and Audio Listening Mode accessories
- Front Panel Brightness Accessory

## Compatibility
- Homebridge: v1.8+ and v2.x
- Node.js: v20+

![Screenshot](AR6.jpg)

# Supported models
- AVM 60,  AVM 70,  AVM 90 
- MRX 310, MRX 510, MRX 710 
- MRX 520, MRX 720, MRX 1120 
- MRX 540, MRX 740, MRX 1140
- MRX SLM

# Getting started
- Install Homebridge and Homebridge UI
- Install homebridge-anthemreceiver plugin
  - From npm (recommended): `sudo hb-service add homebridge-anthemreceiver`
  - For a GitHub branch, see the GitHub installation notes below; accepted `hb-service add` syntax depends on your Homebridge UI version.
- Enable Connected Standby option on Anthem Receiver (Web UI: System Setup -> General -> General Settings)
- Configure the plugin using the Homebridge UI
- Restart the Homebridge server
- ARC, Power, Volume, Mute, Input, Panel Brightness and Audio Listening Mode accessories will be added automatically if enabled. 
- Power/Input accessories are to be manually added in Home App. This step is needed for Apple Remote to be present in Control Center. See procedure below.


# Adding External Power/Input accessory in Home App
## iOS 16
- Enable "Power/Input" accessory in Homebridge UI config page. Restart Homebridge after any modifications
- Open Home App
- Select "+" on the upper-right corner of the screen and select "Add Accessory"
- Select "More options"
- Select "Zone1" or "Zone2" Power/Input Television accessory
- Follow further on-screen instructions to complete configuration

# Apple Remote in Control Center
* Device UP and DOWN physical volume buttons to change volume
* UP and DOWN to change volume
* PLAY AND PAUSE to toggle mute
* LEFT, RIGHT to select input (Main Zone)
* BACK button to switch current audio mode (Main Zone)
* INFO button to show and hide menu display (Main Zone)
* CENTER button to select option (Main Zone)


# Volume mapping (Maximum volume in dB)
- New optional config field: **Maximum volume (dB)**
- Set this to the same maximum volume dB configured on your Anthem receiver (for example `-10`).
- When set:
  - HomeKit volume `0%` sends **Mute**
  - HomeKit volume `1% - 100%` maps linearly to `-89.5 dB` through your configured **Maximum volume (dB)** in `0.5 dB` steps
- When **not** set:
  - The plugin keeps the legacy/default behavior and uses the receiver percentage command (`PVOL`) directly

Example in `config.json`:
```json
{
  "platform": "AnthemReceiver",
  "Host": "192.168.1.50",
  "Port": 14999,
  "MaxVolumeDB": -10
}
```

> Note: In Homebridge JSON config, the property key is `MaxVolumeDB`. In the Homebridge UI label it appears as **Maximum volume (dB)**.

# Configuration UI
The custom settings page groups receiver connection details, Zone 1/Zone 2 accessories, display/volume settings, and Apple Remote pairing help. Existing configuration keys are preserved.

- Use **Test connection** to read model, firmware, inputs, and available zone status using the currently entered address. It does not send power, volume, mute, input-change, or remote-key commands.
- The preview is timestamped. Unknown values are not displayed as Off. Supported controls depend on the receiver model; SLM is a single-zone receiver.
- Settings can be saved while the receiver is offline. Opening, editing, or testing does not persist changes; use Homebridge's **Save** button, then restart the relevant Homebridge instance or child bridge.
- Keep Connected Standby enabled on the receiver.

# Receiver state and recovery
The plugin buffers complete TCP messages, validates responses, and reconnects after closed connections and timeouts. Existing accessories are refreshed after reconnection.

HomeKit writes are serialized and state-setting commands wait for receiver feedback/read-back. Power-on also waits for basic zone status. Commands can fail if a zone remains unready beyond the confirmation deadline. Commands are not replayed automatically after a disconnect.

Relative volume/listening-mode controls verify a subsequent state reply. Navigation keys and on-screen menu toggles do not have a comparable state acknowledgement; those operations confirm the socket write only. This does not prove the receiver performed the navigation action.

# GitHub installation and compiled files
The installed plugin requires the complete `dist` directory. The `prepare` build generates it during normal npm Git dependency installation, and the package allowlist includes compiled modules and custom UI files.

A Git package specification has the form `github:pponce/homebridge-anthemreceiver#<branch-or-tag>`. Use it with an installer that accepts Git dependencies and installs into your existing Homebridge plugin location. Some `hb-service add` versions validate only npm names/versions rather than passing through arbitrary Git specifications. Confirm your exact working command and installed Homebridge UI version before changing workflows.

The current development branch is a draft and is not yet a validated install candidate. Full build/package checks and the user's exact installation path remain release gates; see [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md). No compiled output is fabricated when build dependencies are unavailable.

# Compatibility notes
- Direct listening-mode switches are supported on protocol V02 models. Older receivers retain Apple Remote listening-mode cycling; direct selection is unavailable.
- External TV accessories still require manual pairing in Apple Home. Input changes are reconciled by stable identifiers, including standalone input switches.
- Receiver hardware validation is pending for the current development changes, including simultaneous diagnostic/runtime connections on models that limit control sessions.
