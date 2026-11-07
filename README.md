# AccidentGuard

AccidentGuard is an experimental Android prototype for studying whether smartphone motion sensors can identify a possible high-impact event and start a user-confirmation workflow.

It is a B.Tech major-project prototype, not a certified crash-detection product. Do not rely on it as an emergency service, medical device, vehicle safety system, or replacement for local emergency services.

## Current implementation

- React, TypeScript and Vite interface packaged for Android with Capacitor.
- Native Android SensorManager bridge for foreground accelerometer and gyroscope readings.
- Explicit sensor activation; simulation remains active until fresh hardware samples arrive.
- Sensor mode falls back to simulation when hardware samples become stale or the app is backgrounded.
- Synthetic scenarios for impact, rollover, phone-drop rejection and speed-bump/pothole.
- Experimental rule-based impact candidate detection using acceleration, rotation and a post-impact variance window.
- User confirmation countdown with cancellation.
- Native Capacitor GPS on Android and browser geolocation on web; location is requested after user action.
- Local incident history and an SMS draft that the user must review and send manually.
- Map preview with Google Maps hand-off for nearby hospital search or a selected destination.

## Important limitations

- Detection thresholds have not been validated against a representative real-world crash dataset.
- A phone drop, pothole, hard braking, phone orientation or unusual movement can cause false positives or missed events.
- The detector is heuristic-based. The scripts in ml/ are exploratory and are not connected to the live detection path.
- Monitoring is foreground-only. A validated Android foreground service is not implemented.
- The app does not automatically send SMS, call contacts, contact hospitals or contact emergency services.
- No verified hospital dataset or in-app road-routing provider is configured by default. The app must not invent a hospital, road name, route or ETA.
- Debug APKs are for controlled testing, not Play Store release.

## Development

Requirements: Node.js 22, Java 21 and Android SDK.

Run npm install, npm run dev, npm test, npm run build and npm run build:android. Then run npx cap sync android. In the android directory, run ./gradlew assembleDebug testDebugUnitTest.

The debug APK is generated at android/app/build/outputs/apk/debug/app-debug.apk.

## Safe test plan

Follow docs/DEVICE_TEST_PLAN.md. Use the synthetic scenarios and gentle stationary phone movements only. Never stage a collision, perform dangerous driving or drop a phone from height. Record the phone model, Android version, sensor availability, GPS permission state, and observed results.

## Safety statement

The app records an experimental local incident only. It does not guarantee detection or dispatch emergency help. In a real emergency, contact local emergency services directly.
