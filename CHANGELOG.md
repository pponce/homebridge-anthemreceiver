# Changelog

## 1.0.0-beta.1 — Plus migration candidate (not yet published)

- Add a confirmed Audio Listening Mode **None** switch on protocol V02 models, preserving existing ALM accessory and service identifiers (upstream issue #19). Keep all mode switches off while the zone is off and restore actual mode state after switch-off requests.
- Introduce the independent `homebridge-anthemreceiver-plus` package and maintainership; preserve `AnthemReceiver`, accessory UUID rules, service types, and subtypes for migration.
- Add a real-Homebridge restart migration regression covering cache reassociation and HAP identifiers, plus standalone repository setup and beta publication instructions.
- Buffer and validate TCP replies, including fragmented UTF-8 input names and multi-digit ARC/Dolby responses.
- Normalize configuration and correctly register supported zones; preserve SLM's single-zone behavior.
- Reconnect after clean close/end/error/timeout with owned timers and refresh existing accessories after initialization.
- Serialize HomeKit control requests, confirm supported state changes, and report offline/failed operations.
- Reconcile TV inputs and standalone input switches without rebuilding unchanged services.
- Add a custom Homebridge settings UI with grouped zone controls, validation, and read-only receiver preview.
- Fix Homebridge night-theme contrast across settings text, form fields, help, tables, and buttons; add theme-aware browser contrast checks.
- Include compiled output and UI files explicitly in package contents; add CI and regression tests.

Initial build, browser, archive, and clean npm GitHub-install checks have passed. Night-theme regression checks and physical hardware validation are tracked separately. See IMPROVEMENT_PLAN.md for results and release gates.
