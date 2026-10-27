// Full-screen urgent red alert state with countdown, audible siren, Leaflet map, and accessible "I'M OK" button
import React from 'react';
import { MapView } from './MapView';
import { Hospital } from '../types';
import { Volume2, VolumeX, ShieldAlert, HeartHandshake, PhoneCall } from 'lucide-react';
import { emergencyAudio } from '../services/audioService';

interface AlertScreenProps {
  countdownSeconds: number;
  maxCountdownSeconds: number;
  peakG: number;
  peakGyro: number;
  latitude: number;
  longitude: number;
  nearestHospital: Hospital | null;
  onCancel: () => void;
  onTriggerImmediateDispatch: () => void;
}

export const AlertScreen: React.FC<AlertScreenProps> = ({
  countdownSeconds,
  maxCountdownSeconds,
  peakG,
  peakGyro,
  latitude,
  longitude,
  nearestHospital,
  onCancel,
  onTriggerImmediateDispatch
}) => {
  const isMuted = emergencyAudio.getIsMuted();
  const [muted, setMuted] = React.useState(isMuted);

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    emergencyAudio.setMuted(nextMuted);
  };

  // SVG Circular progress computation
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(0, countdownSeconds / maxCountdownSeconds);
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="alert-screen-overlay">
      <div className="alert-screen-backdrop-pulse"></div>

      <div className="alert-screen-content">
        {/* Urgent Header */}
        <div className="alert-top-bar">
          <div className="alert-badge">
            <ShieldAlert size={18} className="alert-icon-pulse" />
            <span>CRITICAL IMPACT DETECTED</span>
          </div>

          <button
            type="button"
            className="alert-mute-btn"
            onClick={toggleMute}
            title={muted ? 'Unmute Siren' : 'Mute Siren'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span>{muted ? 'MUTED' : 'SIREN'}</span>
          </button>
        </div>

        {/* Circular Countdown Hero */}
        <div className="countdown-hero-section">
          <div className="circular-timer-container">
            <svg className="circular-timer-svg" width="160" height="160" viewBox="0 0 160 160">
              {/* Background ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="timer-track"
                strokeWidth="10"
              />
              {/* Animated countdown ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="timer-fill"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>

            <div className="timer-center-text">
              <span className="countdown-number">{countdownSeconds}</span>
              <span className="countdown-unit">SECONDS</span>
            </div>
          </div>

          <h2 className="alert-headline">Are you OK?</h2>
          <p className="alert-subtext">
            This is an experimental alert. No contact or emergency service is being notified automatically. Cancel if you are safe; use the available manual contact options if you need help.
          </p>
        </div>

        {/* Primary Action: Accessible Large "I'M OK" Tap Target */}
        <div className="alert-actions-group">
          <button
            type="button"
            className="im-ok-button"
            onClick={onCancel}
            id="btn-cancel-alarm"
          >
            <div className="im-ok-inner">
              <HeartHandshake size={32} className="mr-3" />
              <div className="text-left">
                <div className="im-ok-primary-text">I'M OK — CANCEL ALERT</div>
                <div className="im-ok-subtext">False alarm / No assistance needed</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="dispatch-now-button"
            onClick={onTriggerImmediateDispatch}
            id="btn-dispatch-now"
          >
            <PhoneCall size={18} className="mr-2" />
            <span>OPEN EMERGENCY OPTIONS</span>
          </button>
        </div>

        {/* Telemetry and Location Context Card */}
        <div className="alert-telemetry-card">
          <div className="telemetry-row">
            <div>
              <span className="telemetry-label">Peak G-Force:</span>
              <span className="telemetry-value text-red-400 font-bold ml-2">
                {peakG.toFixed(1)}g
              </span>
            </div>
            <div>
              <span className="telemetry-label">Gyro Rotation:</span>
              <span className="telemetry-value text-amber-400 font-bold ml-2">
                {peakGyro.toFixed(0)}°/s
              </span>
            </div>
          </div>

          {nearestHospital && (
            <div className="nearest-hospital-preview mt-2">
              <span className="text-slate-400 text-xs">Nearest Trauma Facility:</span>
              <div className="font-medium text-white text-sm">
                🏥 {nearestHospital.name} ({nearestHospital.distanceKm} km • ETA ~{nearestHospital.etaMinutes}m)
              </div>
            </div>
          )}

          <div className="mini-map-container mt-3">
            <MapView
              latitude={latitude}
              longitude={longitude}
              hospitals={nearestHospital ? [nearestHospital] : []}
              height="130px"
              zoom={14}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
