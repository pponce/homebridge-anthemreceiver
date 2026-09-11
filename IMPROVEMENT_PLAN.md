# Homebridge Anthem Receiver — Reliability and Configuration UI Plan

Date: 2026-09-11  
Status: Implementation in progress on `improvements/reliability-and-config-ui`. See the progress log below.

## 1. Goal and scope

Improve receiver connection reliability, correct confirmed functional defects, modernize the Homebridge configuration experience, and preserve direct GitHub installation.

The user approved the direction of the review and requested this plan. Implementation and upload to GitHub are now authorized. Deployment, receiver changes, and stable releases remain separate work. Preserve existing configuration and HomeKit accessory identities wherever possible; this is not a request to remove older receiver support or configuration formats.

### Current baseline

- Repository: [pponce/homebridge-anthemreceiver](https://github.com/pponce/homebridge-anthemreceiver).
- Runtime review: commit `37de37484a94cb36b0213b961143c698b31ddd08`, package version `0.8.6`.
- Plan baseline: commit `0c35d7d2b43d20161fce345ddf136c602d8dd01a`.
- [Dependabot PR #9](https://github.com/pponce/homebridge-anthemreceiver/pull/9) is now merged. npm and GitHub Actions checks are configured for Mondays at 09:00 America/Los_Angeles, with five open version-update PRs per ecosystem. Do not recreate this work.
- Existing CI targets Node 10–15 although the package declares newer Node versions. The previous review could not run a full build/lint because npm registry access was blocked.
- Selected defects were reproduced using isolated execution with mocked dependencies. This is not hardware validation or a complete Homebridge integration test.

## 2. Delivery order

| Phase | Work | Exit condition |
| --- | --- | --- |
| 1 | Repair build/CI and establish install/package checks | A clean build and the installed package can load; checks run on supported environments. |
| 2 | Correct configuration, zone registration, and protocol parsing | Existing valid configurations work; fragmentation and invalid-response tests pass; model-specific zones are correct. |
| 3 | Harden connection lifecycle and command/state handling | Outages recover predictably, timers do not accumulate, and failed commands do not appear successful. |
| 4 | Add the modern custom configuration UI and read-only connection preview | Configuration round trips safely, setup is understandable, and preview cannot alter receiver state. |
| 5 | Reconcile input services, finish compatibility/hardware checks, and document release | GitHub installation works on the user's actual setup and existing HomeKit pairings survive. |

Use focused PRs or reviewable commits for these phases. Avoid combining wholesale formatting changes, dependency major upgrades, transport fixes, and UI redesign into one diff.

## 3. Planned reliability changes

### R1 — Buffer and validate receiver responses (high)

**Problem:** `AnalyseResponse()` splits each TCP data event independently, losing incomplete messages. For example, `Z1MU` followed by `T1;` loses a valid mute response. Invalid numeric data such as `ICNfoo;` can throw a RangeError.

**Plan:**

- Retain incomplete data across socket events and extract complete semicolon-terminated messages in order.
- Decode fragmented text consistently, including non-ASCII names; use a stream decoder where appropriate.
- Bound the pending buffer and input counts; clear the buffer on disconnect.
- Validate command shape, integer identifiers, numeric values, and model-appropriate ranges before updating state.
- Catch malformed-message failures at the parser boundary and report concise diagnostics without crashing Homebridge.
- Parse multi-digit input identifiers for ARC and Dolby feedback; inputs 10 and above currently fail because the parser uses single-character positions.

**Acceptance:** split a reply at every boundary; handle multiple replies in one packet and a partial trailing reply; reject invalid counts and oversized buffers; verify inputs 1, 9, 10, and supported upper limits; cover both protocol families and SLM input-name decoding.

### R2 — Normalize configuration and register valid zones (high)

**Problem:** missing `Zone1` or `Zone2` objects throw during validation. The missing-port path overwrites the fallback with undefined. Zone 2 registration is gated on already having more than one zone, so it never happens.

**Plan:**

- Introduce one normalized configuration model shared by runtime validation and the UI server.
- Use numeric port 14999 when omitted; validate ports from 1 through 65535.
- Validate a nonempty host and finite `MaxVolumeDB` within its supported range.
- Supply safe defaults for absent zone objects without changing explicitly configured false or zero values.
- Discover model capabilities before registering model-dependent zones and publishing accessories; support configured Zone 2 controls on compatible receivers.
- Keep SLM limited to one zone. Report an incompatible saved setting clearly instead of silently creating invalid accessories.
- An absent/unconfigured host should leave the plugin inactive with a helpful message, without opening a socket.
- Keep existing JSON keys and platform identifiers; correct the README's minimal configuration example.

**Acceptance:** no-config and minimal-config startup; missing one/both zone objects; omitted/custom/invalid port; invalid max dB; Zone 1 only; Zone 2 enabled; SLM with saved Zone 2 settings.

### R3 — Own the socket and timer lifecycle (high)

**Problem:** error and timeout events are handled, but clean close/end are not. Keepalive/reconnect timers are not owned or cancelled, and old readiness state survives reconnection.

**Plan:**

- Use one disconnect path for end, close, error, timeout, and shutdown.
- Keep one active socket generation and one scheduled reconnect; ignore events from obsolete sockets.
- Track/cancel connection, keepalive, reconnect, and pending-command timers.
- Apply capped reconnect backoff with modest jitter; reset it after a stable connection.
- Distinguish connection timeout, handshake timeout, and established-connection inactivity.
- Reset readiness and in-flight work on disconnect; perform a fresh handshake and state refresh on reconnect.
- Publish current state to existing accessories after resynchronization; do not recreate accessories on ordinary reconnect.
- Register Homebridge shutdown cleanup so the controller stops reconnecting and releases listeners and sockets.
- Log the outage once, summarize recovery, and keep packet/timer details at debug level.

**Acceptance:** connection refused, clean close, timeout, device restart, repeated error/close events, disconnect during initialization, stale socket events, and shutdown during retry. Assert one reconnect timer and no growing listener/timer counts.

### R4 — Make HomeKit commands and state truthful (high)

**Problem:** setters generally return after a socket write attempt. That does not establish that the receiver accepted or applied the action.

**Plan:**

- Reject writes when disconnected or not ready using an appropriate HomeKit communication error.
- Serialize receiver transactions with bounded queues and response deadlines.
- Match responses to the relevant zone/property; handle receiver error replies and unsolicited state updates.
- Treat socket write completion as transport progress, not receiver confirmation.
- Confirm changes using receiver feedback or a read-back query where the protocol supports it.
- Account for boot delay after power-on; do not assume power feedback means every control is immediately ready.
- If immediate optimistic display is retained for a particular action, track it as pending and reconcile failures.
- Do not blindly replay toggle, volume-step, or remote-key commands after an uncertain disconnect.
- Initialize every accessory from the current state snapshot, and update it again after reconnect.
- Distinguish unknown/stale state from a confirmed Off state. Keep HomeKit getters inexpensive and coalesce refresh requests.

**Acceptance:** offline command, write failure, receiver rejection, missing/late response, rapid volume requests, power-on followed by another command, and disconnect after a command was sent. Confirm failed operations never become unconditional successes.

### R5 — Reconcile input services without unnecessary re-pairing (medium)

**Problem:** TV input rebuilding removes services but retains references in `HdmiInputService`. Standalone input switches also do not fully follow input-list changes.

**Plan:**

- Reconcile input services using stable numeric input identifiers rather than rebuilding everything.
- Update names in place, add missing services, and remove obsolete ones.
- Replace stale tracking collections and remove associated listeners where necessary.
- Apply changes to both external TV accessories and standalone input selectors.
- Preserve accessory UUIDs and existing service subtypes where possible.
- Render receiver-supplied names as text in the custom UI.

**Acceptance:** rename/add/remove/reorder inputs, repeated refresh, restart with cached services, and unchanged accessories. Confirm stable service counts, no duplicate listeners, and preserved HomeKit assignments.

### R6 — Make model support explicit (medium)

The controller currently assumes MRX 740 when an unknown model is reported. Replace this debug fallback with a clear unsupported-model state unless a validated alias is available. Use a shared capability map for protocol family, zones, brightness, ARC, listening modes, and Dolby controls.

Audit older-model listening-mode support: the UI exposes choices while the protocol V01 setter branch does not implement direct selection. Implement supported commands or accurately limit that control. Do not remove otherwise working older-model functions.

## 4. Modern configuration UI

### Reference experiences examined

| Reference | Observed pattern | Anthem adaptation |
| --- | --- | --- |
| Script2 custom UI | Concise introduction, grouped/collapsible cards, contextual fields, inline validation, native Homebridge Save | One receiver setup screen with grouped zone options and explanations beside the setting. |
| RPC3Control custom UI | Connection card, collapsible advanced settings, read-only connection test with status table | Receiver identity/status preview using unsaved host/port values. |
| Both stylesheets | 960px maximum content width, responsive two-column grids, rounded borders, restrained accent color, Homebridge theme variables | Match the visual language and mobile behavior; adapt copy and controls to Anthem. |
| Both save flows | Disable Save during invalid/pending validation, synchronize through Homebridge's configuration API, explicit Save/restart guidance | Preserve the same save experience and prevent stale validation from enabling Save. |

These references were inspected in source; their live interfaces were not run during this planning task. Adapt relevant patterns rather than copying unrelated PDU/script behavior, migration warnings, or outdated version labels.

### Proposed screen

Use a single settings page with clear sections rather than forcing returning users through a wizard.

| Section | Controls and behavior |
| --- | --- |
| Introduction | “Connect your Anthem receiver to Home.” Brief explanation of zone controls and Apple Remote support. |
| Receiver connection | Host/IP address, port defaulting to 14999, and an explicit “Test connection” action. Explain Connected Standby. |
| Receiver preview | Detected model, protocol/capabilities, available identity information, timestamp, and supported zone/input status. Distinguish unavailable/unknown values from Off. |
| Zone 1 | Zone name and grouped accessory choices: TV/Apple Remote, Power, Mute, Volume, Input Selector, ARC, Listening Mode, and Dolby Processing as supported. |
| Zone 2 | Same applicable controls when supported. Keep the section clearly unavailable for SLM; do not erase existing saved values simply by hiding them. |
| Display and volume | Front-panel brightness where supported. Rename the label to “Maximum volume (dB)” while preserving the JSON key `MaxVolumeDB`. Explain that it maps HomeKit volume and should match the receiver setting. |
| Advanced | Collapse infrequently used connection settings. Expose only settings with a practical user need; keep internal retry bookkeeping out of the form. |
| Save and setup help | Use Homebridge's Save button. Explain restart/child-bridge restart and the extra manual pairing step for external TV accessories. |

### Configuration compatibility requirements

- Retain `Host`, `Port`, `PanelBrightness`, `MaxVolumeDB`, `Zone1`, `Zone2`, existing zone properties, and `platform: "AnthemReceiver"`.
- Preserve unrelated keys and Homebridge metadata such as `_bridge` when editing the plugin configuration.
- Preserve explicit false values, zero values, and omitted optional fields where omission has meaning.
- Do not recreate accessory identifiers because a display label, UI layout, or connection-test result changes.
- Keep basic form validation available even when the receiver is offline. A successful live connection test must not be required to save otherwise valid settings.
- Editing/testing does not save settings; only Homebridge's Save action persists them.
- Opening or saving settings does not send receiver control commands.
- Use shared server/runtime validation, field-level errors, an accessible status region, and protection against out-of-order asynchronous results.
- Use keyboard-accessible controls, visible focus, light/dark theme support, and a mobile single-column layout.

### Read-only connection test

- Require an explicit click. Use the values currently entered in the form.
- Read identity and supported status only; never power on/off, change volume/input/mute, or send remote keys.
- Query only commands available in the reported model and current power state.
- Bound execution time, allow one test at a time, rate-limit retries, and close test resources on completion/cancellation.
- If values change during the test, mark its result stale.
- Some receivers may limit simultaneous connections. Verify this on supported models; reuse/coordinate with the runtime connection where feasible rather than disrupting it with a second socket.
- Connection failure should show a concise actionable message; it must not discard the user's edits.

### Expected implementation files

- Enable the custom UI in `config.schema.json`; retain an accurate schema.
- Add `homebridge-ui/server.js` and `homebridge-ui/public/` HTML, JavaScript, and CSS.
- Add shared configuration validation/capability modules and a read-only tester.
- Declare UI server dependencies as runtime dependencies and include UI files in the installed package.
- Keep the existing module format unless there is a concrete reason to change it.

## 5. Direct GitHub installation and dist

**Requirement: the installed package must contain current, complete compiled `dist` output.** The package entry point is `dist/index.js`; TypeScript source alone is insufficient.

The repository already has `prepare: npm run build`. npm documents that Git dependencies with a prepare script install their build dependencies and run preparation before packaging. With that normal lifecycle enabled, dist can be generated during installation and does not inherently need to be committed. [npm Git installation behavior](https://docs.npmjs.com/cli/v11/commands/npm-install/#description)

RPC3Control follows this general pattern: its inspected repository does not track dist, but it has prepare/prepack build scripts and an explicit package files list including dist and homebridge-ui.

### Planned packaging contract

1. Keep build scripts capable of producing every required runtime file from a clean checkout.
2. Add an explicit package `files` allowlist covering dist, homebridge-ui, config.schema.json, and required documentation/assets.
3. Remove contradictory packaging exclusions. The current `.npmignore` includes dist; do not rely on npm's automatic entry-point inclusion behavior to include all supporting modules.
4. Verify a real packed archive contains the complete import graph and the custom UI. Test loading that installed archive with production dependencies.
5. Exercise fresh Git installation from an immutable candidate commit/tag, with no existing dist or globally installed TypeScript compiler.
6. Check the user's exact hb-service command, Homebridge UI version, npm version, and lifecycle-script settings before finalizing installation instructions.
7. If that installation path requires prebuilt files, provide a documented installable branch/tag containing generated dist and add a CI check that it matches src. Do not manually edit dist.
8. Keep a known-good commit/tag for rollback.

**Installer detail to resolve:** the current upstream hb-service helper inspected for this plan validates a package name/version and constructs an npm add command; it is not a generic pass-through for every Git URL syntax. The user's installed version and working command may differ. Do not assume the user's workflow is broken, and do not publish an untested replacement command. Verify the exact path as part of the release gate.

Simply committing dist does not prevent prepare from running if the script remains configured. If a prebuilt distribution is chosen, design its lifecycle deliberately and test it; do not silently ignore failed builds.

No npm publication is required to use a GitHub branch/tag once that installation path is validated.

## 6. CI, tests, and release acceptance

### Build and CI

- Select and document an intentional supported Node/Homebridge matrix; do not mechanically preserve unsupported claims or old Node 10–15 jobs.
- Update workflow actions to compatible maintained versions; retain the merged weekly Dependabot coverage.
- Commit a package lockfile and use npm ci for reproducible project CI installs.
- Establish passing lint, build, runtime tests, UI tests, and installed-package smoke checks.
- Keep dependency major upgrades reviewable; a Dependabot PR alone does not prove compatibility.
- Verify the checks actually execute on PRs in this repository.

### Focused test coverage

| Area | Required scenarios |
| --- | --- |
| Protocol | Fragmented/coalesced packets, malformed fields, bounded buffers, multi-digit input IDs, both protocol families, SLM names. |
| Configuration | Missing sections, preserved false/zero values, correct defaults, invalid numbers, existing config round trips, metadata preservation. |
| Connection | Clean close, errors, timeouts, receiver reboot, repeated events, stale socket callbacks, bounded reconnects, shutdown. |
| Commands | Confirmed success, rejection, lost response, disconnect after send, boot delay, rapid user actions, no unsafe toggle replay. |
| Accessories | Initial state, reconnect refresh, input reconciliation, no duplicated services/listeners, stable UUIDs. |
| UI | Invalid/pending Save state, stale validation responses, offline save, read-only test, cancellation, dark/light modes, mobile width, keyboard access. |
| Installation | Clean build, packaged import graph, production-only runtime, UI assets/dependencies, exact GitHub installation path and rollback. |

### Hardware/manual release gate

- Test the user's actual receiver first, recording model, firmware, Homebridge, Node, npm, and installation command.
- Validate startup while on and in Connected Standby, power cycling, network outage/recovery, mute/volume/input control, and Apple Remote.
- Validate Zone 2 on a compatible two-zone receiver and SLM single-zone behavior with hardware or clearly identified simulation coverage.
- Confirm existing HomeKit rooms, scenes, and pairings remain intact after upgrade/restart.
- Confirm connection preview does not alter receiver state or interrupt the runtime socket.
- Use a candidate branch/tag before a stable release; record any hardware/protocol combinations not yet tested.
- Update README, compatibility notes, changelog, and installation/rollback instructions to match observed behavior.

## 7. Source references

- [Anthem controller at the reviewed runtime commit](https://github.com/pponce/homebridge-anthemreceiver/blob/37de37484a94cb36b0213b961143c698b31ddd08/src/AnthemController.ts)
- [Anthem platform and configuration](https://github.com/pponce/homebridge-anthemreceiver/blob/37de37484a94cb36b0213b961143c698b31ddd08/src/platform.ts)
- [Anthem input services](https://github.com/pponce/homebridge-anthemreceiver/blob/37de37484a94cb36b0213b961143c698b31ddd08/src/HKPowerInputAccessory.ts)
- [Anthem current package metadata](https://github.com/pponce/homebridge-anthemreceiver/blob/0c35d7d2b43d20161fce345ddf136c602d8dd01a/package.json)
- [Script2 UI](https://github.com/pponce/homebridge-script2/tree/293680443fadcd3b8208679c0aaf54dfedd956ca/homebridge-ui)
- [RPC3Control UI](https://github.com/pponce/homebridge-rpc3control/tree/0affb562cb5a1b5791b9baf159973b3c7476c318/homebridge-ui)
- [RPC3Control packaging/build scripts](https://github.com/pponce/homebridge-rpc3control/blob/0affb562cb5a1b5791b9baf159973b3c7476c318/package.json)
- [Homebridge hb-service implementation inspected](https://github.com/homebridge/homebridge-config-ui-x/blob/bb94ef61d69fac7fe4c412e59397964f22eb6a2a/src/bin/hb-service.ts)
- [npm Git dependency installation](https://docs.npmjs.com/cli/v11/commands/npm-install/#description)

## 8. Implementation progress

### 2026-09-11 — Implementation uploaded in draft PR #10

Branch: `improvements/reliability-and-config-ui`  
PR: https://github.com/pponce/homebridge-anthemreceiver/pull/10

| Area | Implementation status | Verification status |
| --- | --- | --- |
| Dependabot | Merged previously in PR #9 | Config checked on master. |
| R1 protocol parsing | Buffered UTF-8 framing, bounded responses, numeric validation, multi-digit ARC/Dolby parsing implemented | Local fragmentation/malformed-field/protocol-family tests pass. |
| R2 configuration and zones | Shared normalization, numeric port default, safe missing sections, model-driven Zone 2, SLM restriction implemented | Local configuration and platform tests pass. |
| R3 connection lifecycle | Owned socket/timers, close/end/error handling, capped backoff, fresh handshake, snapshot refresh, shutdown implemented | Local real-TCP fake-receiver reconnect tests pass; hardware outage/stability checks pending. |
| R4 commands and state | Bounded serial queue, read-back confirmation, power-on readiness, offline errors, no replay after disconnect implemented | Local confirmation, rejection, timeout, no-replay, and offline-accessory tests pass. Hardware boot latency remains to validate. |
| R5 input services | Stable TV input reconciliation, tracked-array replacement, standalone input reconciliation implemented | Repeated refresh/rename/shrink tests preserve service objects and listener counts. |
| R6 model support | Capability map and unsupported-model rejection implemented; unsupported older-model direct ALM selection no longer appears functional | Capability/protocol-family tests pass. Older-model listening-mode cycling remains available; hardware verification pending. |
| Custom settings UI | Grouped cards, responsive styling, shared server validation, native Save flow, metadata preservation, model-aware options, read-only status preview implemented | Model/diagnostic tests, JS syntax checks, and all four Chromium browser tests pass in GitHub CI. Human visual QA remains pending. |
| CI/package | Node 22/24 × Homebridge 1/2 workflow, type/syntax checks, tests, browser checks, package allowlist, archive install smoke test implemented | GitHub CI passed all four Node 22/24 × Homebridge 1/2 jobs: type checking, compiled tests, package checks, browser tests, and production archive installation. |
| Dependency lockfile | Pending | Must be generated from a successful dependency install and reviewed; it was not fabricated. CI temporarily uses npm install. |
| dist/Git install | prepare build retained; full dist and homebridge-ui explicitly included in packaging | CI generated and validated dist in the package archive, including a production-only install. dist is not committed; clean Git install and the exact hb-service path remain pending. |
| Hardware/release | Not performed | PR remains draft; do not treat it as a stable install candidate. |

### Validation performed

- 21 regression tests passed using Node 24 source transformation, real loopback TCP fake receivers, and mocked Homebridge/HAP objects where applicable.
- The temporary source loader only enabled local testing without npm dependencies. These results do not establish TypeScript type-checking, compiled-package compatibility, or real Homebridge integration.
- All authored JavaScript passed `node --check`; changed TypeScript was parsed through Node's transform support for source-level execution.
- `git diff --check` passed.
- The browser suite stopped at launch because no Chromium executable is installed. No browser or visual pass is claimed.
- `npm install` failed with HTTP 403 from the registry. Consequently build, package-archive execution, and lockfile generation have not passed here.

### Deliberate implementation details and remaining limits

- Existing configuration property names, explicit false/zero values, and unrelated Homebridge metadata are retained. The UI does not require a successful live test to save valid settings.
- Core typed event-emitter dependency was replaced by Node's built-in EventEmitter. The new UI server uses @homebridge/plugin-ui-utils.
- The obsolete ESLint setup was replaced with TypeScript checking plus JavaScript syntax checks for the current lint command. Formatting cleanup was not mixed into the receiver changes.
- State setters confirm exact values where replies permit; relative controls confirm read-back. Navigation/menu operations without protocol acknowledgements only confirm the socket write. Their physical effect remains unconfirmed.
- Power-on polls status within the command deadline and does not replay the power command. Slow real hardware may require tuning after measurement.
- Connection preview uses a separate bounded, read-only socket. Its command list is tested as query-only, but interaction with models that limit simultaneous sessions is a hardware release gate. Cross-process runtime socket sharing is not implemented.
- The repository owner enabled Actions on 2026-09-11. No earlier runs were replayed, so a progress update triggered a fresh branch build. All four CI matrix jobs passed.
- Runtime engines still retain the existing advertised ranges. CI coverage added here targets Node 22 and 24; validating or narrowing the other advertised versions remains pending before release.

### Next gates

1. Generate and review a dependency lockfile, then switch CI to npm ci. The dependency-backed type checks, compiled tests, and archive validation have now passed in GitHub CI.
2. Inspect light/dark and mobile/desktop layouts. All four automated Chromium browser tests now pass in GitHub CI; human visual review remains pending.
3. Validate a clean Git installation using the user's exact hb-service/Homebridge UI/npm setup. Decide whether that path needs a prebuilt branch/tag and verify generated dist if so.
4. Test the user's receiver, including standby, boot timing, network interruption, Apple Remote, and preserved HomeKit pairings. Record model/firmware and any unsupported scenarios.
5. Only after the required checks pass, mark the PR ready for merge and select a release version. No stable release, npm publish, or live installation has been performed.

### 2026-09-11 — Actions activated

- The repository owner confirmed enabling workflows.
- Verified that PR #10 remained mergeable and that no workflow runs or checks had started for the previous commit.
- Pushed this plan update to trigger the build, compiled tests, browser tests, and package checks.
- Keep the PR draft until CI and the remaining installation/hardware gates are satisfied.

### 2026-09-11 — First full CI validation passed

- [PR workflow run 34560373798](https://github.com/pponce/homebridge-anthemreceiver/actions/runs/34560373798) passed all four Node 22/24 × Homebridge 1/2 matrix jobs at commit `47ba78e6392d57b999a3b3838dc2a74af22c5175`.
- Passed TypeScript checking, compiled regression tests, package-content checks, all four Chromium browser tests, and installation/import of the archive using production dependencies.
- This resolves the earlier dependency-backed build and browser execution blockers. Historical local limitations above remain accurate for that environment.
- CI validates generated dist in the archive; it does not establish the exact hb-service GitHub installation path or receiver hardware behavior.
- Receiver and existing installation command supplied below. The installed hb-service/UI and Node/npm versions remain to verify before candidate installation.

### 2026-09-11 — MRX 540 8K and installation workflow confirmed by owner

- Target hardware: Anthem MRX 540 8K. Firmware and the exact model string returned by `IDM?` remain unverified; the code supports `MRX 540`.
- Owner's existing workflow:

  ```bash
  sudo hb-service stop
  sudo hb-service add pponce/homebridge-anthemreceiver
  sudo hb-service start
  ```

- Added MRX 540 to the fake-receiver handshake regression test; the controller suite passes locally. This is simulation coverage, not a physical receiver result.
- Added a separate CI job installing the exact PR commit using npm's `pponce/repository#commit` GitHub syntax, into a clean prefix with `--omit=dev` and lifecycle scripts enabled. It verifies generated dist, entry-point loading, custom UI assets, and the UI runtime dependency. Run outcome is recorded by GitHub Actions.
- Current upstream hb-service parses and validates npm names/versions before invoking npm, and rejects this GitHub shorthand. This does not establish what the owner's installed version accepts. Obtain `sudo hb-service --version`, `node --version`, and `npm --version` before prescribing a branch argument.
- Keep Homebridge running while collecting versions. Before any candidate install, download a Homebridge backup and establish rollback to the currently installed revision. Do not merge the draft to make installation possible.

### 2026-09-11 — APT wrapper identified; candidate install instructions

- Owner reported Node `v24.21.0`, npm `11.19.0`, and `ignore-scripts=false` from sudo commands. These describe the invoking shell; the APT wrapper loads its Homebridge shell environment and runs npm as the service user.
- The `hb-service --version` output identifies the Homebridge APT package wrapper. It does not implement that flag. Its `-V` prints Homebridge's version, not a wrapper version.
- [APT wrapper source](https://github.com/homebridge/homebridge-apt-pkg/blob/latest/deb/opt/homebridge/hb-service-shim) forwards `add` arguments to `npm --prefix /var/lib/homebridge` in the Homebridge environment. The prior concern about the separate UI helper's package-name validation does not apply to this wrapper.
- [CI run 34560707919](https://github.com/pponce/homebridge-anthemreceiver/actions/runs/34560707919) passed all five jobs at `6fc0012323844d06e8ad7e50b28b032ded2df325`: the four existing matrix jobs and the clean GitHub install job. The clean Git job used Node 22; it is not a claim that the user's exact APT environment was reproduced.
- Generated dist, custom UI assets, and the UI dependency were verified in the clean Git install. No prebuilt distribution branch is required for the tested lifecycle.

Before the hardware trial, download a Homebridge backup using the existing UI. Leave the PR draft. Install the immutable candidate that passed CI:

```bash
sudo hb-service stop &&
sudo hb-service add 'pponce/homebridge-anthemreceiver#6fc0012323844d06e8ad7e50b28b032ded2df325' &&
sudo hb-service start
```

If installation fails, capture the output; the `&&` sequence intentionally stops before startup. To return to the repository's default master branch using the owner's existing installation method:

```bash
sudo hb-service stop &&
sudo hb-service add 'pponce/homebridge-anthemreceiver#master' &&
sudo hb-service start
```

This returns to master; it does not promise to restore an unknown exact previously installed commit or saved configuration. The backup protects the prior Homebridge configuration and pairing state. Keep existing accessories and configuration during initial testing.

After successful installation, inspect `sudo hb-service view`, then open plugin settings. Test normal power, mute, low-level volume adjustment, and input selection before testing standby/reconnect and the read-only connection preview. Record firmware, model reported in logs/preview, actual installation output, and any boot timeout. Hardware validation and final merge remain pending.
