// Emergency response review screen. This prototype does not contact hospitals or emergency services.
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
  coords: Coordinates | null;
  nearestHospital: Hospital | null;
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
  const [voiceSpoken, setVoiceSpoken] = useState<boolean>(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);

  // These steps document local preparation only; they are not a network transmission.
  const [transmissionSteps] = useState<DispatchTransmissionStatus[]>([
    {
      step: 1,
      title: 'Location available (permission dependent)',
      detail: coords ? `${coords?.latitude.toFixed(6)}, ${coords?.longitude.toFixed(6)} (accuracy ±${coords?.accuracy ?? 'unknown'}m)` : 'Location unavailable; no coordinates will be included.',
      status: 'completed',
      timestamp: Date.now() - 3000
    },
    {
      step: 2,
      title: 'Impact telemetry prepared (not transmitted)',
      detail: `Recorded sensor reading: ${(incident?.peakG ?? 0).toFixed(1)}g • rotation ${incident?.peakRotation ?? 0}°/s (experimental; not validated).`,
      status: 'completed',
      timestamp: Date.now() - 2000
    },
    {
      step: 3,
      title: 'Emergency message prepared for user review',
      detail: 'Message is only prepared for user review; no contact or emergency endpoint has been notified.',
      status: 'active',
      timestamp: Date.now() - 1000
    },
    {
      step: 4,
      title: 'No dispatch integration configured',
      detail: 'No ambulance or emergency service has been contacted. Use verified local emergency channels in a real emergency.',
      status: 'pending',
      timestamp: Date.now()
    }
  ]);

  const timestamp = incident?.timestamp ?? Date.now();
  const peakG = incident?.peakG ?? 0;

  const smsPayload = coords ? generateEmergencySmsPayload({
    userName: 'AccidentGuard user',
    coords,
    peakG,
    nearestHospital: nearestHospital ?? { id: 'none', name: 'Not selected', address: '', latitude: coords.latitude, longitude: coords.longitude, phone: '', traumaLevel: 'Not verified' },
    timestamp
  }) : { recipientNumbers: [], messageText: 'AccidentGuard incident draft. Device location is unavailable. No emergency service has been contacted.', mapsUrl: '' };

  // Demo draft only. No verified hospital recipient is configured.
  const smsHref = `sms:?body=${encodeURIComponent(smsPayload.messageText)}`;
  const hasVerifiedHospitalPhone = Boolean(nearestHospital?.phone && nearestHospital?.phone.trim());
  const googleMapsHref = coords ? `https://www.google.com/maps?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}` : null;

  // Send Browser Web Notification & Speak Emergency Status
  useEffect(() => {
    // 1. Web Notification API
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('AccidentGuard demo — crash alert preview', {
            body: `Simulated crash alert: ${peakG.toFixed(1)}g. No emergency service was contacted.`,
            icon: '/vite.svg',
            requireInteraction: true
          });
        } catch (err) {
          console.warn('Web notification trigger error:', err);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('AccidentGuard demo — crash alert preview', {
              body: `Simulated crash alert: ${peakG.toFixed(1)}g. No emergency service was contacted.`,
              icon: '/vite.svg'
            });
          }
        });
      }
    }

    // 2. Speech Synthesis voice announcement
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !voiceSpoken && !isVoiceMuted) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          `AccidentGuard demo alert. Simulated vehicle impact of ${peakG.toFixed(1)} G. This is a prototype. No emergency services have been contacted.`
        );
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
        setVoiceSpoken(true);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    }
  }, [peakG, nearestHospital?.name ?? 'No verified facility selected', voiceSpoken, isVoiceMuted]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(smsPayload.messageText).catch(() => {});
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
            <span className="dispatch-live-text">DEMO ALERT — NO DISPATCH SENT</span>
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

        <h1 className="dispatch-title">EMERGENCY ALERT PREVIEW</h1>
        <p className="dispatch-subtitle">
          This screen previews a possible alert. This prototype does not transmit medical telemetry or contact emergency services.
        </p>
      </div>

      {/* Hospital Routing Card */}
      <div className="dispatch-hospital-card">
        <div className="hospital-header">
          <div className="hospital-info">
            <span className="hospital-tag">{nearestHospital?.traumaLevel ?? 'No verified facility selected'}</span>
            <h2 className="hospital-name">{nearestHospital?.name ?? 'No verified facility selected'}</h2>
            <p className="hospital-address">
              <MapPin size={14} className="inline mr-1 text-slate-400" />
              {nearestHospital?.address ?? 'No verified facility data available'}
            </p>
          </div>
          <div className="hospital-eta-badge">
            <span className="eta-num">{nearestHospital?.etaMinutes ?? '—'}</span>
            <span className="eta-unit">MIN ETA</span>
            <span className="distance-num">({nearestHospital?.distanceKm ?? '—'} km straight-line distance)</span>
          </div>
        </div>

        {/* Demo actions only. No verified hospital phone number is configured. */}
        <div className="hospital-actions-bar">
          <a
            href={smsHref}
            className="action-btn direct-sms-btn"
            id="btn-direct-sms"
          >
            <Send size={18} />
            <span>Open demo SMS draft — verify before sending</span>
          </a>

          {hasVerifiedHospitalPhone ? (
            <a
              href={`tel:${(nearestHospital?.phone ?? '').replace(/[^0-9+]/g, '')}`}
              className="action-btn direct-call-btn"
              id="btn-direct-call"
            >
              <PhoneCall size={18} />
              <span>Call verified hospital ({nearestHospital?.phone ?? ''})</span>
            </a>
          ) : (
            <span className="action-btn direct-call-btn" aria-disabled="true">
              <PhoneCall size={18} />
              <span>No verified hospital number configured</span>
            </span>
          )}

          <a
            href={googleMapsHref ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn google-maps-btn"
            id="btn-google-maps"
            aria-disabled={!googleMapsHref}
            onClick={(event) => { if (!googleMapsHref) event.preventDefault(); }}
          >
            <ExternalLink size={18} />
            <span>{coords ? 'View current device coordinates on Google Maps' : 'Location unavailable'}</span>
          </a>
        </div>
      </div>

      {/* Interactive Map View with Incident Coordinates & Hospital */}
      {coords && <div className="dispatch-map-wrapper">
        <div className="dispatch-map-header">
          <div className="flex items-center space-x-2">
            <Radio size={16} className="text-cyan-400 animate-pulse" />
            <span className="font-semibold text-white">Location preview — not emergency routing</span>
          </div>
          <span className="text-xs text-slate-400">
            {coords ? `Current coordinates: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : 'Location unavailable — map not centered on current position'}
          </span>
        </div>
        {coords ? <MapView
          latitude={coords.latitude}
          longitude={coords.longitude}
          hospitals={nearestHospital ? [nearestHospital] : []}
          zoom={14}
          height="220px"
        /> : <p role="status">Location unavailable. Grant location permission and retry to show the current position.</p>}
      </div>}
      {!coords && <p role="status">Location unavailable. Grant location permission and retry to show the current position.</p>}

      {/* Local incident preparation status — no dispatch backend */}
      <div className="dispatch-transmission-feed">
        <h3 className="section-title">
          <Shield size={16} className="text-emerald-400" />
          <span>Simulated Alert Workflow — No Dispatch Backend</span>
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
          <span className="sms-label">Emergency SMS draft — review before sending</span>
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
          <span className="recipients-label">Saved contacts (not automatically notified):</span>
          {smsPayload.recipientNumbers.map((num, idx) => (
            <span key={idx} className="recipient-pill">{num}</span>
          ))}
        </div>
      </div>

      {/* Emergency Contacts — Not Alerted Automatically */}
      <div className="emergency-contacts-summary">
        <h3 className="section-title">
          <PhoneCall size={16} className="text-cyan-400" />
          <span>Emergency contacts (not automatically notified)</span>
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
          <span>Return to monitoring</span>
        </button>
      </div>
    </div>
  );
};
