# 🛡️ AccidentGuard — Intelligent Accident Detection & Emergency Response

> **Real-time vehicular crash detection** powered by smartphone accelerometer/gyroscope fusion, automated trauma center dispatch, and live GPS navigation — all in one app.

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-AccidentGuard-00d4ff?style=for-the-badge)](https://hiializgar.github.io/Accident-Guard/)
[![Play Store Ready](https://img.shields.io/badge/📱_Play_Store-Ready-34a853?style=for-the-badge)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)]()
[![React](https://img.shields.io/badge/React_19-Optimized-61dafb?style=for-the-badge&logo=react&logoColor=black)]()

---

## 🚀 What is AccidentGuard?

AccidentGuard is a **production-grade safety application** that transforms any smartphone into an intelligent crash detection system. It continuously monitors vehicle motion at **50Hz** using device sensors and automatically dispatches emergency services when a severe collision is detected.

### Key Features

| Feature | Description |
|---|---|
| 🎯 **50Hz Crash Detection** | Real-time accelerometer + gyroscope fusion with NHTSA-calibrated 3.5g impact threshold |
| 🧠 **False Positive Rejection** | Post-impact stillness analysis rejects phone drops, potholes, and speed bumps |
| 🗺️ **Dual-Engine Maps** | Google Maps Platform + MapTiler/Leaflet fallback with automotive dark cockpit styling |
| 🏥 **Trauma Center Routing** | Haversine-sorted nearest hospitals with one-tap ER call and live ETA |
| 📡 **Automated SOS Dispatch** | Emergency SMS with GPS coordinates, impact severity, and Google Maps link |
| ⏱️ **15s Abort Countdown** | Conscious drivers can cancel false alarms; unconscious victims get rapid dispatch |
| 📊 **Live Sensor Telemetry** | Real-time oscilloscope waveform, G-force meter, and sensor diagnostics |
| 🚗 **Driving HUD** | Speed, heading, road name, speed limits, and road hazard warnings |
| 🔔 **Audio + Haptic Alerts** | Web Audio API siren with Capacitor native vibration |
| 📱 **Play Store Ready** | Capacitor Android shell with WakeLock, background GPS, and offline support |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   React 19 UI                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │Drive HUD │ │ Sensors  │ │ Emergency Alert  │ │
│  │  + Map   │ │Telemetry │ │  + Dispatch      │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │             │                │           │
│  ┌────┴─────────────┴────────────────┴─────────┐ │
│  │           Service Layer (Singleton)          │ │
│  │                                              │ │
│  │  sensorService ──► crashDetector ──► audio   │ │
│  │  (50Hz loop)       (state machine)   (siren) │ │
│  │                                              │ │
│  │  navigationService  locationService  hardware│ │
│  │  (5Hz telemetry)    (GPS + Haversine) (wake) │ │
│  │                                              │ │
│  │  googleMapsService (dual-engine map loader)  │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Crash Detection State Machine

```
NORMAL ──[impact ≥ 3.5g]──► IMPACT_DETECTED ──[0.4s]──► CONFIRMING
   ▲                                                        │
   │                                               ┌───────┴───────┐
   │                                               ▼               ▼
   │                                        [stillness OK    [motion detected
   │                                         + gyro tumble]   or no tumble]
   │                                               │               │
   │                                               ▼               │
   │                                        COUNTDOWN (15s)        │
   │                                         │           │         │
   │                                    [user cancel] [timeout]    │
   │                                         │           │         │
   └─────────────────────────────────────────┘           ▼         │
                                                  ALERT_TRIGGERED  │
                                                         │         │
                                                         ▼         │
                                                    DISPATCHED     │
   ◄──────────────────[FALSE_ALARM]────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript (strict mode) |
| **Maps** | Google Maps JS API, MapTiler Cloud, Leaflet |
| **Build** | Vite 6 with chunk splitting |
| **Mobile** | Capacitor 8 (Android) |
| **Sensors** | DeviceMotion API (50Hz), Geolocation API |
| **Audio** | Web Audio API (synthesized sirens) |
| **Styling** | Custom CSS with automotive dark theme |
| **Icons** | Lucide React |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/HiiAliasgar/Accident-Guard.git
cd Accident-Guard

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables (Optional)

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_MAPTILER_API_KEY` | Optional | MapTiler Cloud key for HD map tiles |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | Google Maps Platform key for native Google Maps |

> **Note:** The app works perfectly without any API keys — it falls back to free OpenStreetMap/CartoDB tiles.

### Build for Production

```bash
npm run build
```

### Build for Android (Play Store)

```bash
npx cap sync android
npx cap open android
```

See [PLAYSTORE_PACKAGE_GUIDE.md](./PLAYSTORE_PACKAGE_GUIDE.md) for complete Play Store deployment instructions.

---

## 📱 Screenshots

### Cockpit Navigation HUD
Dark-themed automotive navigation with real-time speed, road alerts, and hospital routing.

### Sensor Telemetry
Live 50Hz oscilloscope waveform with G-force impact analysis.

### Emergency Dispatch
Full-screen SOS countdown with automated trauma center notification.

---

## 🔬 Crash Detection Calibration

| Parameter | Value | Rationale |
|---|---|---|
| **Impact Threshold** | 3.5g | NHTSA FMVSS 208: real crashes ≥ 3.5g, harsh braking ≤ 1.0g |
| **Stillness Window** | 3.0s | Discriminates post-crash immobility from phone handling |
| **Stillness Variance** | 0.25g | Below = stationary vehicle; above = active movement |
| **Gyro Tumble** | 180°/s | Confirms vehicular rotation vs. simple drop |
| **Countdown** | 15s | Balance between false alarm cancellation and rapid dispatch |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🔗 Links

- **Live Demo**: [https://hiializgar.github.io/Accident-Guard/](https://hiializgar.github.io/Accident-Guard/)
- **Privacy Policy**: [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)
- **Play Store Guide**: [PLAYSTORE_PACKAGE_GUIDE.md](./PLAYSTORE_PACKAGE_GUIDE.md)

---

<p align="center">
  Built with ❤️ for road safety<br>
  <strong>AccidentGuard</strong> — Because every second counts in an emergency
</p>
