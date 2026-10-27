# AccidentGuard 2.0 — Rebuild plan

## Safety posture
This is an experimental student project, not a certified crash-detection or emergency-response system. Do not rely on it as the only means of getting help. No UI, test, or simulation is proof of real-world crash-detection accuracy.

## Current defects confirmed by source inspection
- `src/App.tsx` initializes location to San Francisco (37.7749, -122.4194), creates fabricated saved contacts, and presents a simulated navigation/road-alert service as default.
- `src/services/navigationService.ts` advances through hard-coded San Francisco coordinates, seeded demo hazards, and simulated speed/ETA.
- `src/services/locationService.ts` explicitly defines unverified demo hospital fixtures; its distance-based ETA is not road routing.
- `src/services/sensorService.ts` generates synthetic frames and can select simulation based on user-agent; presence of `DeviceMotionEvent` does not prove data availability or permission.
- `src/services/crashDetector.ts` is a rule-based experimental heuristic. It is not a trained ML model or validated for real-world driving.
- `src/services/googleMapsService.ts` reads user-saved API keys from local storage; a stale invalid key can continue to break Google Maps until cleared.

## Target architecture
- UI: small React screens with truthful data-source labels and accessible status.
- Sensors: capability/permission assessment and explicit real, reduced-capability, and simulation modes.
- Detection: isolated rule-based baseline with typed state transitions; optional ML inference only when a valid, versioned model exists.
- Location: real permission-driven position and reported accuracy; no silent demo-coordinate fallback.
- Navigation: a provider interface; route geometry, distance and ETA only from an actual routing provider; explicit external-maps fallback.
- Alerts: audio/haptic service with a user-gesture sound test, cleanup, and platform limitations clearly stated.
- Emergency workflow: user-managed contacts; message draft/manual confirmation unless a supported and authorized native send path is implemented; delivery state is never inferred from opening an SMS app.
- QA/security: unit and integration tests, dependency audits, CI, no secrets in frontend source.

## Rebuild checklist
- [x] Create recoverable branch from current main without changing main.
- [ ] Remove fabricated contacts and hard-coded coordinates from runtime defaults.
- [ ] Make navigation simulator explicit and opt-in; remove fake road intelligence from production UI.
- [ ] Ensure unavailable/denied location is represented as unavailable.
- [ ] Implement sensor capability and stale-sample checks.
- [ ] Test crash state machine, cancellation, duplicate-event protection and alert cleanup.
- [ ] Audit map-provider fallback and saved invalid keys.
- [ ] Implement persisted user-selected emergency contacts and truthful SMS draft status.
- [ ] Add reproducible ML dataset ingestion/training scaffold; do not claim trained model until valid data/model exists.
- [ ] Run npm ci, npm test, npm run build, Android Gradle tests/build and emulator checks.
- [ ] Verify GitHub Actions and live deployment by commit.

## Completion gate
Do not mark a checklist item complete until implementation exists and its relevant tests or documented manual verification support it. Physical-device/background behavior and model safety require evidence beyond GitHub CI.
