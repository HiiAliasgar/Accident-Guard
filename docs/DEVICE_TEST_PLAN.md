# AccidentGuard device and scenario test plan

## Scope and safety

This plan checks software behavior and sensor plumbing. It does not validate real-world crash detection or certify the app for emergency use.

Never stage a vehicle collision, drive dangerously or drop a phone from height. Use built-in synthetic scenarios and gentle stationary phone movements only. Keep the app in the foreground; background monitoring is not implemented.

## Record for each device session

- Phone make/model and Android version
- App version and Git commit
- Accelerometer available (yes/no)
- Gyroscope available (yes/no)
- Sensor mode before and after enabling
- Location permission (precise / approximate / denied)
- GPS accuracy reported by Android
- Test case, expected result, observed result and notes

## Automated cases

| Case | Input | Expected behavior |
|---|---|---|
| SVC-01 | Launch without sensor activation | Simulation is clearly labelled |
| SVC-02 | Native sensor start succeeds, no sample yet | Still labelled simulation |
| SVC-03 | Valid fresh accelerometer frame | Hardware mode can activate |
| SVC-04 | Invalid frame with NaN/Infinity | Frame ignored |
| SVC-05 | No fresh accelerometer frame for 250 ms | Falls back to simulation |
| SVC-06 | Gyroscope available but no fresh gyro frame | Does not claim live gyro data |
| SVC-07 | User switches to simulation | Native listener stops and is removed |
| SVC-08 | App is backgrounded | Sensor stream stops; foreground monitoring must be re-enabled |
| GPS-01 | Native permission granted | Actual GPS coordinates returned |
| GPS-02 | Permission denied or location disabled | Explicit error; no fabricated coordinates |

## Real-device procedure

1. Install the debug APK on the target Android phone.
2. Open Sensors and explicitly enable device sensors.
3. Confirm the interface stays in simulation until fresh accelerometer readings arrive.
4. Gently tilt and rotate the phone while stationary. Confirm readings change and gyro availability is reported separately from fresh gyro samples.
5. Switch back to simulation and confirm the native stream stops.
6. Repeat enable/disable at least five times to check for duplicate listeners or stale data.
7. Background the app. Confirm the sensor stream stops and the UI does not claim background monitoring. Reopen it and explicitly re-enable sensors.
8. Tap Refresh GPS and test precise permission, approximate permission, denied permission and location services disabled.
9. Confirm no hospital, road name, route or ETA is shown as live unless a real provider supplies it.
10. Run each synthetic scenario at least five times and record the result. This tests software repeatability, not real-world accuracy.
11. Trigger the confirmation countdown and cancel it. Confirm no SMS or call is sent automatically.
12. Allow a synthetic countdown to finish. Confirm only a local incident is recorded.

## Release gates

Do not describe the app as production-ready until automated tests, emulator smoke tests, real-device sensor checks, GPS permission checks, false-positive/false-negative evaluation on a representative dataset, background-service design (if needed), privacy review and release signing are completed.
