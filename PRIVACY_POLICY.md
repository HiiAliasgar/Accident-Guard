# Privacy Policy — AccidentGuard Mobile Application

**Last Updated**: September 11, 2026  
**Effective Date**: September 11, 2026  
**Application**: AccidentGuard (`com.accidentguard.app`)

AccidentGuard ("we", "our", or "us") is dedicated to protecting your privacy and delivering a reliable, life-saving vehicular collision detection service. This Privacy Policy explains how our mobile application collects, processes, and protects your information when you use AccidentGuard on Android or via our Progressive Web App (PWA).

---

## 1. Information We Collect and Process

### A. Device Inertial Sensor Data (IMU)
- **Data Collected**: 3-axis accelerometer readings ($x, y, z$ in $\text{m/s}^2$ or $g$-force) and 3-axis gyroscope angular velocity ($\alpha, \beta, \gamma$ in $\text{deg/s}$).
- **Sampling Frequency**: High-frequency sampling at approximately 50 Hz (20ms intervals) via Android's `HIGH_SAMPLING_RATE_SENSORS`.
- **Purpose**: Real-time collision impulse detection ($\ge 3.5g$), vehicular tumble analysis, and 3.0-second post-impact stillness verification to suppress false alarms (such as dropped phones).
- **Storage & Retention**: Sensor data is processed **locally on your device in volatile memory (RAM)** using a rolling circular buffer. Sensor data is never transmitted to external analytics servers or sold to third parties.

### B. Geolocation Data (GPS)
- **Data Collected**: Precise GPS latitude, longitude, heading, and speed telemetry (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`).
- **Purpose**: 
  1. Identifying nearest Level-1 and Level-2 trauma centers using Haversine spherical distance calculation.
  2. Formatting emergency dispatch SMS payloads and navigation links (`maps.google.com/?q=lat,lng`) for emergency services and family contacts.
  3. Real-time automotive cockpit HUD display.
- **Permission**: Requested at runtime. Location is never tracked or shared for advertising purposes.

### C. Emergency Contacts & Medical Preferences
- **Data Collected**: Names, phone numbers, and relationships of user-specified emergency contacts stored via `localStorage` or native app storage.
- **Purpose**: Automated dispatch of emergency SMS alerts and one-tap calling when an impact is confirmed.

---

## 2. Permissions Declared & Engineering Rationale

| Permission | Android API Level | Rationale |
| :--- | :--- | :--- |
| `HIGH_SAMPLING_RATE_SENSORS` | API 31+ (Android 12+) | Required to sample device IMU at $\ge 50\text{Hz}$ to capture rapid automotive crash deceleration curves without OS throttling. |
| `ACCESS_FINE_LOCATION` | All | Enables high-precision GPS telemetry for dispatching first responders to the exact incident coordinates. |
| `FOREGROUND_SERVICE` & `WAKE_LOCK` | All | Prevents Android Doze mode and OS battery optimization from killing the collision detection pipeline while driving. |
| `SEND_SMS` / `CALL_PHONE` | All | Allows conscious or automated dispatch of trauma center telemetry and direct emergency hotline dialing. |
| `POST_NOTIFICATIONS` | API 33+ (Android 13+) | Displays sticky status notification indicating that driver protection is active. |

---

## 3. Data Sharing & Third-Party Disclosure

- **Emergency First Responders**: If a vehicular crash is verified and the 15-second abort countdown expires, your location coordinates and impact severity are sent via standard SMS/cellular intent to your designated contacts and local emergency dispatch.
- **Google Maps Platform (Optional)**: If you configure a Google Maps API Key in Settings, map tile requests and directions queries are processed directly through Google Cloud APIs in accordance with Google's Privacy Policy.
- **No Commercial Sale of Data**: We do not sell, rent, or monetize your sensor, location, or personal telemetry.

---

## 4. Data Security & On-Device Processing

- All collision evaluation logic, threshold calculations, and state machine transitions occur directly on the device CPU/NPU.
- Crash history logs stored on-device can be permanently deleted by the user at any time in **Settings &gt; Clear Logs**.

---

## 5. Children's Privacy
AccidentGuard does not knowingly collect information from children under the age of 13.

---

## 6. Contact & Data Controller
For any privacy inquiries or data rights requests, please contact:
- **Email**: privacy@accidentguard.app
- **Developer**: AccidentGuard Safety Engineering Team
- **Website**: https://accidentguard.app
