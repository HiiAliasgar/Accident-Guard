# AccidentGuard 2.0 Architecture

## Status
Rebuild work is in progress. This document describes the target architecture; it is not a claim that all modules are implemented or production validated.

## Principles
- Preserve `main` and Git history; implement changes on `rebuild/accidentguard-2.0`.
- Keep simulation and live device input separate and visibly labelled.
- Treat crash detection as an experimental assistance feature, not a certified safety system.
- Never infer a collision from GPS alone.
- Never report emergency-message delivery unless the platform or provider confirms it.
- Never show fabricated traffic, road hazards, hospitals, model metrics, or location as live data.
- Keep external API keys out of source control and restrict browser keys by origin and API.

## Proposed boundaries
- `domain/detection`: pure detection state machine, thresholds, feature windows, event contracts.
- `platform/sensors`: sensor capability assessment, permission and lifecycle adapters, unit normalization.
- `domain/ml`: optional model interface and input/output validation; no model is considered validated without reproducible held-out evaluation.
- `platform/alerts`: audio and haptics adapters with explicit user-gesture initialization and cleanup.
- `platform/location`: GPS acquisition, permission handling, timestamp and accuracy.
- `navigation`: provider interface, geocoding, route geometry, distance/ETA and external-map fallback.
- `emergency`: contact validation, consent, incident message construction, platform handoff and truthful status.
- `storage`: schema-validated local settings and incident history; minimize personal data.
- `ui`: dashboard, monitoring status, map, contacts, history, settings, diagnostics and simulation screen.
- `qa`: deterministic unit tests, integration tests, CI and documented device-only checks.

## Detection modes
1. Sensor mode: use supported motion sensors and report sensor quality.
2. Reduced capability: manual emergency activation and clear limitations; GPS is location context, not collision evidence.
3. Simulation: deterministic synthetic scenarios; every screen and log must label simulated input.

## Incident lifecycle
NORMAL -> IMPACT_CANDIDATE -> CONFIRMING -> COUNTDOWN -> ALERT_REQUESTED -> NOTIFICATION_HANDOFF/CONFIRMED/FAILED.
Cancellation and recovery are explicit transitions. Duplicate incidents are suppressed, timers and audio are disposed on every exit path, and notification handoff is not equivalent to delivery.

## Navigation contract
A provider must return route geometry, distance, duration, attribution and provider metadata. A tile layer alone is not a routing engine. Missing credentials or offline conditions must lead to a clear external-maps fallback, not invented data.

## ML acceptance
The model remains optional until the dataset license and labels are documented, splits avoid subject/session leakage, evaluation artifacts are reproducible, false-positive burden and missed-event behavior are reported, and target-device inference is measured. If real crash labels are absent, state that real-world crash performance cannot be established.

## Release gates
- TypeScript production build and unit tests pass.
- Android Gradle build and available emulator tests pass.
- CI is green on the candidate commit, not merely queued.
- Real-device checks are reported separately from mocks/emulators.
- Required API credentials, permissions, data licensing and platform limitations are documented.
- No merge to `main` until review and release gates are satisfied.
