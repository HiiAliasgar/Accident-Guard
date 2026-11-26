# Privacy Policy — AccidentGuard

**Last updated:** October 26, 2026  
**Application ID:** `com.accidentguard.app`

AccidentGuard is an experimental student prototype for exploring phone motion sensors, location display, and simulated crash-alert screens. It is not a certified safety product and must not be relied on in an emergency.

## Information processed

- **Motion sensors:** When the relevant feature is active, the app may read accelerometer and gyroscope values to demonstrate experimental crash-detection logic. The algorithm has not been validated for real-world crash detection.
- **Location:** If you grant location permission and use a location feature, the app may read the device's current location to display coordinates or a map. Location may be sent to map providers when you use their map services.
- **Information you enter:** Any contact or preference information you enter may be stored by the app in local browser/app storage, depending on the feature used.

## Emergency alerts and calls

The current prototype does **not** automatically contact emergency services, dispatch an ambulance, or transmit crash telemetry to a hospital. The alert screen can display demonstration hospital data and prepare an SMS draft or open the phone's calling interface if you choose an action. Demonstration hospital names, coordinates, distances, and contact details must not be treated as verified information. Review any recipient and message before sending it.

## Sharing and third-party services

The app does not operate its own emergency dispatch backend. If you open a map, SMS, or telephone link, the relevant third-party app or provider handles that interaction under its own terms and privacy policy. Do not enter sensitive information into this prototype.

## Permissions

The Android build requests network access, foreground location access, notifications, vibration, and high-rate motion-sensor access where supported. It does not require background location, direct SMS-sending permission, or direct phone-call permission in the current prototype. You can manage Android permissions in system settings; disabling them may make related features unavailable.

## Data retention and deletion

The prototype does not provide a verified server-side account or emergency-response service. Locally stored app data can generally be cleared through Android app settings or the browser's site-data controls. Map providers and other apps may retain data according to their own policies.

## Children's privacy

This prototype is not designed for children under 13.

## Contact

This repository is maintained as a student project. No verified support email or company address has been configured. For code issues, use the repository's GitHub issue tracker:
https://github.com/HiiAliasgar/Accident-Guard/issues
