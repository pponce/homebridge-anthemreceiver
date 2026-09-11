# Homebridge verification preparation — not submitted

Package: `homebridge-anthemreceiver-plus`  
Repository: https://github.com/pponce/homebridge-anthemreceiver-plus  
Maintainer: Pedro Ponce de Leon (`pponce`)  
Current candidate: `1.0.0-beta.1`

## Successor explanation

This independent project continues the original Anthem receiver plugin with active maintenance and additional functionality. At review on 2026-09-11, upstream ALM None issue #19 and Homebridge 2 issue #20 remained open with no comments, and the upstream default branch had not changed since 2023-10-07. The successor adds or carries forward configurable maximum-volume mapping, a custom configuration UI with read-only diagnostics and day/night support, Homebridge 1/2 validation, ALM None selection, receiver recovery and command confirmation, and input reconciliation. See ACKNOWLEDGEMENTS.md for primary links and attribution.

We request assessment as a maintained successor, including whether it should replace the older plugin's verification status. We do not assume the original badge transfers automatically.

## Why the platform name stays AnthemReceiver

`AnthemReceiver` is intentionally retained as the configuration/platform alias to preserve existing configuration and support Homebridge's cached-accessory reassociation after a package rename. The npm package and registered plugin identifier are distinct: `homebridge-anthemreceiver-plus`. The migration instructions prevent both packages from loading for the same receiver and preserve existing accessory UUIDs, service types/subtypes and bridge identity.

The technical compatibility rationale stands independently of upstream inactivity. It is not a request to reuse the original npm package name or claim official endorsement. The Homebridge team may request changes during review.

## Before submitting

- Publish a tested package to npm and create the matching GitHub release with release notes.
- Confirm installation of the actual published package, including compiled dist and custom UI assets.
- Record the standalone repository's CI links, including migration checks for the tested Homebridge versions.
- Record real MRX 540 8K migration results: existing pairings, rooms, scenes, automations, volume/input/mute/ALM controls, and restart.
- Record whether the real installation uses a child bridge and whether that exact migration path was tested.
- Review the current verification form and answer truthfully. A checked test case does not establish every requirement; no blanket compliance claim is made here.
- Preserve license and attribution; keep issues enabled; do not display a verification badge before acceptance.
- Resolve or disclose the dependency-lockfile follow-up and untested receiver/firmware combinations.

When ready, use the current verification issue template in https://github.com/homebridge/plugins/issues/new/choose. No verification request or message to the original developer has been sent as part of this preparation.

