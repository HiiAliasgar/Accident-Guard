# AccidentGuard 2.0 Rebuild Checklist

This checklist tracks work; items must only be checked after evidence is recorded.

## Phase 0 — Baseline and recovery
- [ ] Confirm rebuild branch base and preserve main.
- [ ] Capture existing source tree, scripts, dependency lockfile, Android configuration and CI status.
- [ ] Run baseline tests/build and record failures.
- [ ] Review reference-project licenses and applicable terms.
- [ ] Inventory API keys/configuration without exposing secrets.

## Phase 1 — Truth and safety
- [ ] Remove hard-coded default location and demo navigation from production mode.
- [ ] Clearly separate live, unavailable and simulated data in state and UI.
- [ ] Ensure missing motion sensors leads to manual emergency mode, not false automatic-detection claims.
- [ ] Remove unverified emergency contacts/hospital data from production defaults.
- [ ] Ensure alert/message states describe actual platform outcomes.

## Phase 2 — Core architecture
- [ ] Define typed contracts and a pure, deterministic incident state machine.
- [ ] Normalize sensor units/timestamps and validate data quality.
- [ ] Implement lifecycle-safe sensor subscriptions and cleanup.
- [ ] Add accessible mobile-first dashboard and settings flows.
- [ ] Add schema-validated storage and privacy-conscious diagnostics.

## Phase 3 — Alerts, location, navigation, contacts
- [ ] Test sound initialization, alert escalation, mute, cancellation and cleanup.
- [ ] Test location permission denial, stale coordinates and poor accuracy.
- [ ] Detect invalid map credentials and fall back without a broken watermark.
- [ ] Integrate a real routing provider or clearly expose external-map fallback.
- [ ] Validate saved contacts and consent; report message handoff/delivery accurately.
- [ ] Document Android background execution and SMS distribution restrictions.

## Phase 4 — ML
- [ ] Document dataset source, license, schema and genuine event labels.
- [ ] Implement data validation and leakage-safe session-aware splits.
- [ ] Train baseline and candidate model reproducibly.
- [ ] Save confusion matrix, precision, recall, F1, false positives/hour where measurable, missed-event analysis, latency and model size.
- [ ] Integrate optional inference only after compatibility and held-out evaluation.
- [ ] If suitable labeled crash data is unavailable, leave ML marked experimental/incomplete.

## Phase 5 — Verification and release
- [ ] Run `npm ci`, `npm test`, `npm run build`.
- [ ] Run Android unit tests, APK build and supported emulator tests.
- [ ] Run dependency/security audit and review each upgrade.
- [ ] Verify CI result on final candidate commit.
- [ ] Verify deployment URL and deployed commit.
- [ ] Perform real-device checks for sensors, sound, GPS, background behavior and messaging where hardware is available.
- [ ] Publish evidence-based report with known limitations.
