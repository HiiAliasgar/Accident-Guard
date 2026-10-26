# AccidentGuard

AccidentGuard is an experimental student project exploring smartphone motion sensors, location display, and simulated crash-alert screens. It is **not a certified safety app** and must not be relied on in a real emergency.

[Live demo](https://hiializgar.github.io/Accident-Guard/) · [Source code](https://github.com/HiiAliasgar/Accident-Guard)

## Current status

- React, TypeScript, Vite, and Capacitor Android shell.
- Experimental accelerometer/gyroscope crash-detection logic.
- Foreground location and map display when permission is granted.
- Simulated alert countdown, siren/voice preview, and an SMS draft for manual review.
- Unit tests for selected location and crash-detection service behavior.
- GitHub Actions checks run unit tests and the production web build, and build an Android debug APK, run local JVM tests, and launch the activity in an Android emulator smoke test.

## Important limitations

- Crash thresholds are experimental and have not been validated for real-world driving.
- Hospital entries and coordinates are demonstration fixtures, not verified facilities. No real hospital phone numbers are configured by default.
- The app does not automatically contact an ambulance, hospital, emergency service, or emergency contact. It has no dispatch backend.
- Background monitoring and reliable behavior across Android device models have not been established.
- A passing CI build does not prove crash-detection accuracy or physical-device behavior.
- Do not test while driving or contact real emergency services as part of testing.

## Development

Requirements: Node.js and npm. Android builds also require the Android SDK and a supported JDK.

```bash
git clone https://github.com/HiiAliasgar/Accident-Guard.git
cd Accident-Guard
npm install
npm test
npm run build
npx cap sync android
```

To open the Android project in Android Studio:

```bash
npx cap open android
```

## Android and Google Play

The CI workflow produces a **debug APK** for engineering checks; this is not a signed production release. Before any Play Store submission, verify all data and permissions, complete physical-device testing, review the privacy policy, prepare a signed Android App Bundle (AAB), and complete Play Console declarations. See [PLAYSTORE_PACKAGE_GUIDE.md](./PLAYSTORE_PACKAGE_GUIDE.md).

## Privacy

See [PRIVACY_POLICY.md](./PRIVACY_POLICY.md). The policy is a project draft and must be checked against the exact behavior of any release build before publication.

## License

MIT — see [LICENSE](./LICENSE).
