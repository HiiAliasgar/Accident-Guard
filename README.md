# AccidentGuard

**An experimental smartphone-based accident-detection and location-aware alert prototype.**

AccidentGuard explores whether smartphone motion sensors can help identify crash-like events and support a location-aware alert workflow. The project combines a React/TypeScript interface with a Capacitor Android application.

> **Safety notice:** AccidentGuard is an experimental student project, not a certified safety application. It has not been validated for real-world driving and must never be relied on in an emergency.

[Live web demo](https://hiialiasgar.github.io/Accident-Guard/) · [Source repository](https://github.com/HiiAliasgar/Accident-Guard)

## Project scope

- React, TypeScript and Vite application.
- Capacitor Android shell.
- Experimental accelerometer and gyroscope crash-candidate detection logic.
- Foreground location and map display when the user grants permission.
- Simulated alert countdown, siren/voice preview and an SMS draft for manual review.
- Unit tests for selected location and crash-detection service behavior.
- GitHub Actions workflow for unit tests, web production build, Android debug compilation, local JVM tests and emulator smoke testing.

## Current limitations

- Detection thresholds are experimental and have not been validated for real-world driving.
- Phone drops, abrupt movement and device placement can cause false positives or missed events.
- Hospital entries and coordinates are demonstration fixtures, not verified facilities. Real hospital phone numbers are not configured by default.
- The application does not automatically contact an ambulance, hospital, emergency service or emergency contact. There is no dispatch backend.
- Reliable background monitoring across Android devices has not been established.
- A successful CI build does not demonstrate detection accuracy or prove physical-device behavior.
- Do not test while driving or contact real emergency services during development tests.

## Development setup

Requirements: Node.js, npm, Android SDK and a supported JDK for Android builds.

```bash
git clone https://github.com/HiiAliasgar/Accident-Guard.git
cd Accident-Guard
npm install
npm test
npm run build
npx cap sync android
```

Open the native Android project:

```bash
npx cap open android
```

## Android build and release notes

The CI workflow builds a **debug APK** for engineering checks. A debug artifact is not a signed production release and should not be distributed as a safety product.

Before any public release, the project requires physical-device testing, validated detection behavior, permission and privacy review, a verified privacy policy, a signed Android App Bundle (AAB), and completed Play Console declarations. See [PLAYSTORE_PACKAGE_GUIDE.md](./PLAYSTORE_PACKAGE_GUIDE.md).

## Privacy

See [PRIVACY_POLICY.md](./PRIVACY_POLICY.md). The policy is a project draft and must be checked against the exact behavior of the release build before publication.

## License

MIT — see [LICENSE](./LICENSE).
