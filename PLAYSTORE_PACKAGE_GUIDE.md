# AccidentGuard — Google Play Store Production Publishing Guide

This guide provides everything needed to compile, sign, and publish **AccidentGuard** (`com.accidentguard.app`) to the **Google Play Console**.

---

## 1. Google Play Store Listing Copy

### App Title (Max 30 Characters)
```text
AccidentGuard: Crash Alert
```

### Short Description (Max 80 Characters)
```text
Automotive collision detection, 50Hz sensor filter & emergency trauma dispatch.
```

### Full Description (Max 4,000 Characters)
```text
AccidentGuard is a high-performance vehicular accident detection and emergency response system engineered for drivers, motorcyclists, and fleet operators.

Utilizing your smartphone's internal 3-axis accelerometer and 3-axis gyroscope sensors sampled at ~50 Hz, AccidentGuard continuously monitors vehicular dynamics to identify catastrophic impacts in real time.

==============================================
KEY FEATURES & ENGINEERING SPECIFICATIONS
==============================================

• 50Hz HIGH-FREQUENCY SENSOR PIPELINE
Samples linear acceleration and angular velocity at 20ms intervals (Nyquist compliant), capturing the complete deceleration impulse shockwave curve (80ms - 200ms) without causing mobile CPU thermal throttling.

• BIOMECHANICAL COLLISION THRESHOLDING
Calibrated to NHTSA and FMVSS automotive crash test data. Uses dynamic jerk analysis and resultant magnitude filtering (threshold: ≥3.5g) to trigger confirmation only on genuine high-energy collisions.

• ADVANCED FALSE ALARM REJECTION (NO UNWANTED CALLS)
Dropping your phone or hitting a harsh road bump will NOT trigger false 911 calls. AccidentGuard monitors a 3.0-second post-impact observation window for stillness variance (<0.25g) and multi-axis tumbling (≥180°/s). If normal motion continues (e.g. you pick up your phone), the alert is instantly dismissed.

• 15-SECOND EMERGENCY ABORT COUNTDOWN
In the event of a verified crash, a high-decibel acoustic siren and pulsating visual countdown appear. If you are unhurt, tap "I'M OK" with one touch to abort dispatch.

• AUTOMATED FIRST RESPONDER & SMS DISPATCH
If you are incapacitated and the countdown expires, AccidentGuard immediately compiles your exact GPS telemetry, peak impact G-force, and nearest Level-1/Level-2 trauma center coordinates, automatically dispatching SMS alerts and initiating emergency desk calls.

• DUAL-ENGINE AUTOMOTIVE COCKPIT MAP
Switch effortlessly between Google Maps Platform (with custom high-contrast Night Cockpit styling and turn-by-turn routing) and free OpenStreetMap/Leaflet raster navigation.

• ZERO-CELLULAR OFFLINE PROTECTION
AccidentGuard features offline service worker caching. The core collision detection state machine, motion sensors, and emergency audio sirens remain 100% operational even in remote mountain corridors with no cellular signal.

==============================================
DATA PRIVACY & ON-DEVICE SAFETY
==============================================
• No Tracking: Your driving sensor telemetry is processed entirely in volatile memory on your device.
• Emergency Use Only: GPS coordinates are accessed solely for emergency proximity routing and dispatch.
• Transparent Policy: Read our complete Privacy Policy at https://accidentguard.app/privacy

Drive with confidence. Protect yourself and your loved ones with AccidentGuard.
```

---

## 2. Google Play Data Safety Form Answers

When completing Google Play Console's mandatory **Data Safety** questionnaire:

| Questionnaire Field | Answer | Notes |
| :--- | :--- | :--- |
| **Does your app collect or share user data?** | **Yes** | Required due to Location & Emergency Contacts |
| **Is all user data encrypted in transit?** | **Yes** | HTTPS & secure system intents |
| **Do you provide a way for users to request data deletion?** | **Yes** | Clear Logs button in Settings |
| **Location: Precise Location (`ACCESS_FINE_LOCATION`)** | **Collected (Not Shared)** | Purpose: *App Functionality* (emergency dispatch) |
| **Personal Info: Emergency Contacts** | **Collected (Not Shared)** | Purpose: *App Functionality* (stored locally on-device) |
| **Sensors / Health: Accelerometer & Gyroscope** | **Ephemeral Processing** | Data is analyzed in real-time in RAM and not stored permanently |
| **Advertising / Marketing?** | **No** | AccidentGuard contains zero advertisements or ad SDKs |

---

## 3. Generating a Release Signing Keystore

To sign your Android App Bundle (`.aab`) for Google Play:

Run the following command in PowerShell:

```powershell
keytool -genkey -v -keystore upload-keystore.jks -alias accidentguard -keyalg RSA -keysize 2048 -validity 10000
```
*(Store `upload-keystore.jks` and your keystore password securely; Google Play requires this key for all future app updates).*

---

## 4. Building the Android App Bundle (`.aab`)

### Option A: Via Android Studio (GUI)
1. Open Android Studio.
2. Click **Open an Existing Project** and select `d:\code\android`.
3. Allow Gradle to finish syncing.
4. In the top menu, navigate to **Build > Generate Signed Bundle / APK...**
5. Select **Android App Bundle** and click **Next**.
6. Select your `upload-keystore.jks` file, enter your password and alias.
7. Select **Release** build variant and click **Finish**.
8. Your output `.aab` file will be generated in `android/app/release/app-release.aab`.

### Option B: Via Command Line (Gradle)
```powershell
cd android
./gradlew bundleRelease
```
The resulting `.aab` will be located at:
`android/app/build/outputs/bundle/release/app-release.aab`

### Option C: Automated Cloud Build (GitHub Actions)
Push the codebase to GitHub. Our automated workflow in `.github/workflows/build-android.yml` will compile the code, sync Capacitor, and generate the Android bundle automatically in GitHub Actions artifacts!

---

## 5. Google Play Console Submission Steps

1. Log in to [Google Play Console](https://play.google.com/console).
2. Click **Create App**:
   - App Name: `AccidentGuard: Crash Alert`
   - Default Language: `English (United States)`
   - App or Game: `App`
   - Free or Paid: `Free`
3. Complete **App Content & Policies**:
   - **Privacy Policy**: Paste URL pointing to your hosted `PRIVACY_POLICY.md` (e.g. GitHub Pages or website).
   - **Data Safety**: Fill out according to the table in Section 2 above.
   - **Target Audience**: 18+ (Drivers / Automotive safety).
4. Complete **Main Store Listing**:
   - Paste the App Title, Short Description, and Full Description from Section 1.
   - Upload App Icon (512x512 PNG, provided in `public/icon-512.svg`).
   - Upload Feature Graphic (1024x500 PNG).
   - Upload phone screenshots of Cockpit HUD, Sensor Waveform, and Trauma Coverage.
5. Under **Release > Production** (or **Closed Testing**):
   - Click **Create New Release**.
   - Upload your `app-release.aab`.
   - Add release notes (e.g. `v1.0.0 — Production release of AccidentGuard vehicular crash detection & emergency trauma routing`).
   - Click **Review and Roll Out**!
