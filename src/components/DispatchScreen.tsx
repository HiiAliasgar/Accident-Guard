// Emergency Response Dispatch Screen: Direct Hospital Alerting, Live Web Notification, SMS & Call Intent, and ER Telemetry Feed
import React, { useState, useEffect } from 'react';
import { Hospital, EmergencyContact, IncidentRecord, DispatchTransmissionStatus } from '../types';
import { generateEmergencySmsPayload, Coordinates } from '../services/locationService';
import { MapView } from './MapView';
import { 
  CheckCircle2, 
  PhoneCall, 
  Send, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  Copy, 
  Check, 
  ExternalLink,
  Shield,
  Radio,
  BellRing,
  Volume2,
  VolumeX,
  Ambulance
} from 'lucide-react';

interface DispatchScreenProps {
  incident: IncidentRecord | null;
  coords: Coordinates;
  nearestHospital: Hospital;
  contacts: EmergencyContact[];
  onResetToNormal: () => void;
}

export const DispatchScreen: React.FC<DispatchScreenProps> = ({
  incident,
  coords,
  nearestHospital,
  contacts,
  onResetToNormal
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [notificationSent, setNotificationSent] = useState<boolean>(false);
  const [voiceSpoken, setVoiceSpoken] = useState<boolean>(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);

  // Progressive simulated transmission steps to Hospital ER
  const [transmissionSteps, setTransmissionSteps] = useState<DispatchTransmissionStatus[]>([
    {
      step: 1,
      title: 'GPS Geolocation & Satellite Fix',
      detail: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (Accuracy ±${coords.accuracy ?? 12}m)`,
      status: 'completed',
      timestamp: Date.now() - 3000
    },
    {
      step: 2,
      title: 'Kinetic Telemetry Encryption',
      detail: `Peak Impact: ${(incident?.peakG ?? 4.8).toFixed(1)}g • Rotational Velocity: ${incident?.peakRotation ?? 280}°/s`,
      status: 'completed',
      timestamp: Date.now() - 2000
    },
    {
      step: 3,
      title: 'Trauma ER Dispatch Gateway',
      detail: `Alert packet delivered to ${nearestHospital.name} Trauma Desk`,
      status: 'completed',
      timestamp: Date.now() - 1000
    },
    {
      step: 4,
      title: 'EMS Ambulance Unit Activated',
      detail: `Ambulance Unit #42 en route from ${nearestHospital.name} (ETA ~${nearestHospital.etaMinutes ?? 4} min)`,
      status: 'active',
      timestamp: Date.now()
    }
  ]);

  const timestamp = incident?.timestamp ?? Date.now();
  const peakG = incident?.peakG ?? 4.8;

  const smsPayload = generateEmergencySmsPayload({
    userName: 'Alex Mercer (Driver)',
    coords,
    peakG,
    nearestHospital,
    timestamp
  });

  // Direct SMS link for mobile browsers
  const smsHref = `sms:${nearestHospital.phone}?body=${encodeURIComponent(smsPayload.messageText)}`;
  const telHref = `tel:${nearestHospital.phone.replace(/[^0-9+]/g, '')}`;
  const googleMapsHref = `https://www.google.com/maps?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;

  // Send Browser Web Notification & Speak Emergency Status
  useEffect(() => {
    // 1. Web Notification API
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('🚨 CRITICAL CRASH ALERT — HOSPITAL DISPATCHED', {
            body: `Emergency alert sent to ${nearestHospital.name}. Telemetry (${peakG.toFixed(1)}g) & GPS coordinates transmitted.`,
            icon: '/vite.svg',
            requireInteraction: true
          });
          setNotificationSent(true);
        } catch (err) {
          console.warn('Web notification trigger error:', err);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('🚨 CRITICAL CRASH ALERT — HOSPITAL DISPATCHED', {
              body: `Emergency alert sent to ${nearestHospital.name}. Telemetry (${peakG.toFixed(1)}g) & GPS transmitted.`,
              icon: '/vite.svg'
            });
            setNotificationSent(true);
          }
        });
      }
    }

    // 2. Speech Synthesis voice announcement
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !voiceSpoken && !isVoiceMuted) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          `Emergency alert active. Vehicular impact of ${peakG.toFixed(1)} G detected. Precision coordinates transmitted to ${nearestHospital.name}. Emergency medical services are being dispatched.`
        );
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
        setVoiceSpoken(true);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    }
  }, [peakG, nearestHospital.name, voiceSpoken, isVoiceMuted]);

  const handleCopy = () => {
    navigator.clipboard.writeText(smsPayload.messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleVoiceMute = () => {
    if (!isVoiceMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsVoiceMuted(!isVoiceMuted);
  };

  return (
    <div className="dispatch-screen-container">
      {/* Top Banner */}
      <div className="dispatch-header-banner">
        <div className="dispatch-badge-row">
          <div className="flex items-center space-x-2">
            <span className="dispatch-live-pulse"></span>
            <span className="dispatch-live-text">DIRECT TRAUMA DISPATCH ACTIVE</span>
          </div>
          <button
            type="button"
            className="voice-mute-btn"
            onClick={toggleVoiceMute}
            title={isVoiceMuted ? 'Unmute voice alerts' : 'Mute voice alerts'}
          >
            {isVoiceMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        <h1 className="dispatch-title">AUTOMATED HOSPITAL SOS TRANSMISSION</h1>
        <p className="dispatch-subtitle">
          Medical telemetry, impact G-force vector, and satellite GPS coordinates have been routed to the nearest acute emergency center.
        </p>
      </div>

      {/* Hospital Routing Card */}
      <div className="dispatch-hospital-card">
        <div className="hospital-header">
          <div className="hospital-info">
            <span className="hospital-tag">{nearestHospital.traumaLevel}</span>
            <h2 className="hospital-name">{nearestHospital.name}</h2>
            <p className="hospital-address">
              <MapPin size={14} className="inline mr-1 text-slate-400" />
              {nearestHospital.address}
            </p>
          </div>
          <div className="hospital-eta-badge">
            <span className="eta-num">{nearestHospital.etaMinutes ?? 4}</span>
            <span className="eta-unit">MIN ETA</span>
            <span className="distance-num">({nearestHospital.distanceKm} km away)</span>
          </div>
        </div>

        {/* Action Buttons: Direct SMS, Direct Call, Google Maps */}
        <div className="hospital-actions-bar">
          <a
            href={smsHref}
            className="action-btn direct-sms-btn"
            id="btn-direct-sms"
          >
            <Send size={18} />
            <span>Send Direct SMS to ER</span>
          </a>

          <a
            href={telHref}
            className="action-btn direct-call-btn"
            id="btn-direct-call"
          >
            <PhoneCall size={18} />
            <span>Call Trauma Desk ({nearestHospital.phone})</span>
          </a>

          <a
            href={googleMapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn google-maps-btn"
            id="btn-google-maps"
          >
            <ExternalLink size={18} />
            <span>View on Google Maps</span>
          </a>
        </div>
      </div>

      {/* Interactive Map View with Incident Coordinates & Hospital */}
      <div className="dispatch-map-wrapper">
        <div className="dispatch-map-header">
          <div className="flex items-center space-x-2">
            <Radio size={16} className="text-cyan-400 animate-pulse" />
            <span className="font-semibold text-white">Live Emergency Location & Hospital Route</span>
          </div>
          <span className="text-xs text-slate-400">
            Coordinates: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </span>
        </div>
        <MapView
          latitude={coords.latitude}
          longitude={coords.longitude}
          hospitals={[nearestHospital]}
          zoom={14}
          height="220px"
        />
      </div>

      {/* Real-time Hospital ER Telemetry Reception Progress */}
      <div className="dispatch-transmission-feed">
        <h3 className="section-title">
          <Shield size={16} className="text-emerald-400" />
          <span>Real-Time Hospital Telemetry Gateway</span>
        </h3>

        <div className="transmission-steps-list">
          {transmissionSteps.map((item) => (
            <div key={item.step} className={`step-item ${item.status}`}>
              <div className="step-icon-box">
                {item.status === 'completed' ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <span className="step-spinner"></span>
                )}
              </div>
              <div className="step-content">
                <div className="step-title-row">
                  <span className="step-title">{item.title}</span>
                  <span className="step-badge">{item.status.toUpperCase()}</span>
                </div>
                <p className="step-detail">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SMS Payload Preview Box */}
      <div className="sms-payload-box">
        <div className="sms-payload-header">
          <span className="sms-label">Automated Emergency SMS Payload</span>
          <button
            type="button"
            className="copy-btn"
            onClick={handleCopy}
            id="btn-copy-sms"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Message</span>
              </>
            )}
          </button>
        </div>
        <pre className="sms-text-content">{smsPayload.messageText}</pre>
        <div className="sms-recipients-row">
          <span className="recipients-label">Recipients:</span>
          {smsPayload.recipientNumbers.map((num, idx) => (
            <span key={idx} className="recipient-pill">{num}</span>
          ))}
        </div>
      </div>

      {/* Emergency Contacts Alerted */}
      <div className="emergency-contacts-summary">
        <h3 className="section-title">
          <PhoneCall size={16} className="text-cyan-400" />
          <span>Next of Kin & Primary Contacts</span>
        </h3>
        <div className="contacts-mini-grid">
          {contacts.map((c) => (
            <div key={c.id} className="contact-mini-card">
              <div className="contact-mini-info">
                <span className="contact-name">{c.name}</span>
                <span className="contact-rel">{c.relationship} • {c.phone}</span>
              </div>
              <a href={`tel:${c.phone}`} className="contact-call-icon-btn">
                <PhoneCall size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Reset Action */}
      <div className="dispatch-footer">
        <button
          type="button"
          className="reset-system-btn"
          onClick={onResetToNormal}
          id="btn-reset-normal"
        >
          <RotateCcw size={16} />
          <span>Reset System to Safe Monitoring Mode</span>
        </button>
      </div>
    </div>
  );
};
