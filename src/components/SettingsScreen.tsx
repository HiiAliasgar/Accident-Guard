// Settings Screen: Sensitivity Threshold Sliders, Emergency Contacts Manager, Hospital Database & Google Maps Platform
import React, { useState } from 'react';
import { DetectionThresholds, EmergencyContact, Hospital, MapEngine } from '../types';
import { 
  Sliders, 
  Users, 
  Building2, 
  Plus, 
  Trash2, 
  Shield, 
  Info, 
  Check, 
  MapPin, 
  Key, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  Globe
} from 'lucide-react';
import { googleMapsService } from '../services/googleMapsService';

interface SettingsScreenProps {
  thresholds: DetectionThresholds;
  onUpdateThresholds: (t: Partial<DetectionThresholds>) => void;
  contacts: EmergencyContact[];
  onAddContact: (c: EmergencyContact) => void;
  onDeleteContact: (id: string) => void;
  hospitals: Hospital[];
  mapEngine?: MapEngine;
  onSelectMapEngine?: (engine: MapEngine) => void;
  onApiKeySaved?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  thresholds,
  onUpdateThresholds,
  contacts,
  onAddContact,
  onDeleteContact,
  hospitals,
  mapEngine = 'auto',
  onSelectMapEngine,
  onApiKeySaved
}) => {
  const [activeTab, setActiveTab] = useState<'thresholds' | 'contacts' | 'hospitals' | 'maps'>('thresholds');
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => googleMapsService.getApiKey());
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // MapTiler State
  const [mapTilerKeyInput, setMapTilerKeyInput] = useState<string>(() => googleMapsService.getMapTilerKey());
  const [showMapTilerKey, setShowMapTilerKey] = useState<boolean>(false);
  const [mapTilerSavedSuccess, setMapTilerSavedSuccess] = useState<boolean>(false);


  // New Contact Form State
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('Family');

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const contact: EmergencyContact = {
      id: `contact-${Date.now()}`,
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: newRelation,
      isPrimary: contacts.length === 0
    };

    onAddContact(contact);
    setNewName('');
    setShowAddContact(false);
  };

  const handleSaveApiKey = () => {
    googleMapsService.saveApiKey(apiKeyInput);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onApiKeySaved?.();
  };

  const handleClearApiKey = () => {
    googleMapsService.clearApiKey();
    setApiKeyInput('');
    setTestStatus('idle');
    setTestMessage('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onApiKeySaved?.();
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKeyInput.trim();
    if (!keyToTest) {
      setTestStatus('error');
      setTestMessage('Please enter an API key first.');
      return;
    }
    setTestStatus('testing');
    setTestMessage('Contacting Google Maps Platform API...');
    try {
      googleMapsService.saveApiKey(keyToTest);
      await googleMapsService.loadGoogleMaps();
      setTestStatus('success');
      setTestMessage('Authenticated with Google Maps JavaScript API!');
      onApiKeySaved?.();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setTestStatus('error');
      setTestMessage(errMsg || 'Authentication failed. Check if Maps JavaScript API is enabled in Google Cloud.');
    }
  };

  const hasConfiguredKey = googleMapsService.hasApiKey();
  const hasMapTilerKey = googleMapsService.hasMapTilerKey();

  const handleSaveMapTilerKey = () => {
    googleMapsService.saveMapTilerKey(mapTilerKeyInput);
    setMapTilerSavedSuccess(true);
    setTimeout(() => setMapTilerSavedSuccess(false), 3000);
    onApiKeySaved?.();
  };

  const handleClearMapTilerKey = () => {
    googleMapsService.clearMapTilerKey();
    setMapTilerKeyInput('');
    setMapTilerSavedSuccess(true);
    setTimeout(() => setMapTilerSavedSuccess(false), 3000);
    onApiKeySaved?.();
  };

  return (
    <div className="settings-screen-container">
      {/* Tab Switcher */}
      <div className="settings-nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'thresholds' ? 'active' : ''}`}
          onClick={() => setActiveTab('thresholds')}
        >
          <Sliders size={16} className="mr-1.5" />
          <span>Sensitivity</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          <Users size={16} className="mr-1.5" />
          <span>Contacts ({contacts.length})</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'hospitals' ? 'active' : ''}`}
          onClick={() => setActiveTab('hospitals')}
        >
          <Building2 size={16} className="mr-1.5" />
          <span>Trauma Centers</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'maps' ? 'active' : ''}`}
          onClick={() => setActiveTab('maps')}
          id="tab-btn-maps-settings"
        >
          <MapPin size={16} className="mr-1.5" />
          <span>Maps & APIs</span>
        </button>
      </div>

      {/* SENSITIVITY THRESHOLDS TAB */}
      {activeTab === 'thresholds' && (
        <div className="tab-pane-content">
          <div className="info-banner mb-4">
            <Info size={16} className="text-cyan-400 mr-2 flex-shrink-0" />
            <p className="text-xs text-slate-300">
              Experimental parameters only. These thresholds have not been validated against NHTSA, SAE, or real-world crash data; changing them does not make this app safety-certified.
            </p>
          </div>

          {/* Slider 1: Impact G-Force */}
          <div className="slider-control-card">
            <div className="slider-header">
              <span className="slider-title">Impact Spike Threshold</span>
              <span className="slider-value-badge text-red-400">
                {thresholds.impactThresholdG.toFixed(1)}g
              </span>
            </div>
            <p className="slider-subtext">
              Minimum resultant deceleration impulse to trigger impact confirmation. (Recommended: 3.5g)
            </p>
            <input
              type="range"
              min="2.0"
              max="6.0"
              step="0.1"
              value={thresholds.impactThresholdG}
              onChange={(e) => onUpdateThresholds({ impactThresholdG: parseFloat(e.target.value) })}
              className="range-slider"
            />
            <div className="slider-ticks">
              <span>2.0g (Sensitive)</span>
              <span>3.5g (Standard)</span>
              <span>6.0g (Heavy Crash)</span>
            </div>
          </div>

          {/* Slider 2: Stillness Observation Window */}
          <div className="slider-control-card">
            <div className="slider-header">
              <span className="slider-title">Post-Impact Stillness Window</span>
              <span className="slider-value-badge text-amber-400">
                {thresholds.stillnessDurationSec.toFixed(1)}s
              </span>
            </div>
            <p className="slider-subtext">
              Duration to evaluate vehicle halt before initiating emergency countdown.
            </p>
            <input
              type="range"
              min="1.5"
              max="5.0"
              step="0.5"
              value={thresholds.stillnessDurationSec}
              onChange={(e) => onUpdateThresholds({ stillnessDurationSec: parseFloat(e.target.value) })}
              className="range-slider"
            />
            <div className="slider-ticks">
              <span>1.5s (Quick)</span>
              <span>3.0s (Recommended)</span>
              <span>5.0s (Extended)</span>
            </div>
          </div>

          {/* Slider 3: Gyroscope Tumbling Threshold */}
          <div className="slider-control-card">
            <div className="slider-header">
              <span className="slider-title">Gyro Tumbling Filter</span>
              <span className="slider-value-badge text-cyan-400">
                {thresholds.gyroTumbleThresholdDegPerSec}°/s
              </span>
            </div>
            <p className="slider-subtext">
              Angular velocity cutoff to verify vehicular spin/rollover vs dropped phone.
            </p>
            <input
              type="range"
              min="100"
              max="400"
              step="20"
              value={thresholds.gyroTumbleThresholdDegPerSec}
              onChange={(e) => onUpdateThresholds({ gyroTumbleThresholdDegPerSec: parseInt(e.target.value) })}
              className="range-slider"
            />
            <div className="slider-ticks">
              <span>100°/s</span>
              <span>180°/s (Default)</span>
              <span>400°/s</span>
            </div>
          </div>

          {/* Slider 4: Emergency Countdown Timer */}
          <div className="slider-control-card">
            <div className="slider-header">
              <span className="slider-title">Emergency Countdown Duration</span>
              <span className="slider-value-badge text-emerald-400">
                {thresholds.countdownDurationSec}s
              </span>
            </div>
            <p className="slider-subtext">
              Abort window before dispatching coordinates and simulated SMS.
            </p>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={thresholds.countdownDurationSec}
              onChange={(e) => onUpdateThresholds({ countdownDurationSec: parseInt(e.target.value) })}
              className="range-slider"
            />
            <div className="slider-ticks">
              <span>5s (Rapid)</span>
              <span>15s (Optimal)</span>
              <span>30s (Cautious)</span>
            </div>
          </div>

          {/* OPTIMIZATION TOGGLE 1: Adaptive Sampling */}
          <div className="slider-control-card">
            <div className="flex justify-between items-center">
              <div>
                <span className="slider-title block">Adaptive Sensor Sampling</span>
                <p className="slider-subtext mt-1">
                  Dynamically modulates IMU polling: 30Hz cruising → 60Hz crash burst.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={thresholds.adaptiveSampling}
                  onChange={(e) => onUpdateThresholds({ adaptiveSampling: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* OPTIMIZATION TOGGLE 2: Power Saver Mode */}
          <div className="slider-control-card">
            <div className="flex justify-between items-center">
              <div>
                <span className="slider-title block">Battery Power Saver Mode</span>
                <p className="slider-subtext mt-1">
                  Reduces idle CPU wakeups by capping background sampling to 30Hz.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={thresholds.powerSaverMode}
                  onChange={(e) => onUpdateThresholds({ powerSaverMode: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* EMERGENCY CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <div className="tab-pane-content">
          <div className="contacts-action-bar mb-3">
            <span className="text-sm font-semibold text-slate-200">Notified in Emergency:</span>
            <button
              type="button"
              className="add-contact-btn"
              onClick={() => setShowAddContact(!showAddContact)}
            >
              <Plus size={14} className="mr-1" />
              <span>Add Contact</span>
            </button>
          </div>

          {showAddContact && (
            <form onSubmit={handleCreateContact} className="add-contact-form">
              <h4 className="text-xs font-bold text-cyan-400 uppercase mb-2">New Emergency Contact</h4>
              <div className="form-group mb-2">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group mb-2">
                <input
                  type="tel"
                  placeholder="Mobile Phone (+1...)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group mb-3">
                <select
                  value={newRelation}
                  onChange={(e) => setNewRelation(e.target.value)}
                  className="form-input"
                >
                  <option value="Family">Family / Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Doctor">Personal Physician</option>
                  <option value="Friend">Friend / Colleague</option>
                </select>
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="form-submit-btn">Save Contact</button>
                <button
                  type="button"
                  className="form-cancel-btn"
                  onClick={() => setShowAddContact(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="contacts-list">
            {contacts.map((contact) => (
              <div key={contact.id} className="contact-item-card">
                <div className="contact-avatar">
                  {contact.name.charAt(0)}
                </div>
                <div className="contact-details">
                  <div className="flex items-center space-x-2">
                    <span className="contact-name">{contact.name}</span>
                    {contact.isPrimary && (
                      <span className="primary-pill">Primary</span>
                    )}
                  </div>
                  <span className="contact-phone">{contact.phone} • {contact.relationship}</span>
                </div>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    className="delete-contact-btn"
                    onClick={() => onDeleteContact(contact.id)}
                    title="Remove contact"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOSPITALS TAB */}
      {activeTab === 'hospitals' && (
        <div className="tab-pane-content">
          <div className="info-banner mb-3">
            <Building2 size={16} className="text-emerald-400 mr-2 flex-shrink-0" />
            <p className="text-xs text-slate-300">
              Verified Level-1 and Level-2 trauma centers within priority emergency radius.
            </p>
          </div>

          <div className="hospitals-list">
            {hospitals.map((hosp, idx) => (
              <div key={hosp.id} className="hospital-item-card">
                <div className="hospital-card-top">
                  <div>
                    <span className="hosp-rank">#{idx + 1} Trauma Center</span>
                    <h3 className="hosp-name">{hosp.name}</h3>
                  </div>
                  <span className="hosp-level">{hosp.traumaLevel}</span>
                </div>
                <p className="hosp-addr">{hosp.address}</p>
                <div className="hosp-footer">
                  <span className="hosp-phone">📞 {hosp.phone}</span>
                  <span className="hosp-coords">
                    {hosp.latitude.toFixed(4)}, {hosp.longitude.toFixed(4)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAPS & GOOGLE APIS TAB */}
      {activeTab === 'maps' && (
        <div className="tab-pane-content">
          {/* Active Status Banner */}
          <div className={`map-engine-status-card ${hasConfiguredKey ? 'google-active' : 'leaflet-active'}`}>
            <div className="flex items-start space-x-3">
              <div className="engine-status-icon">
                {hasConfiguredKey ? (
                  <Globe className="text-cyan-400" size={24} />
                ) : (
                  <MapPin className="text-emerald-400" size={24} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="engine-badge-title">
                    {hasConfiguredKey ? 'Google Maps Platform' : 'Leaflet / OpenStreetMap'}
                  </span>
                  <span className={`status-pill ${hasConfiguredKey ? 'pill-active' : 'pill-free'}`}>
                    {hasConfiguredKey ? '🟢 Official API' : '🔵 Free Fallback'}
                  </span>
                </div>
                <p className="engine-status-subtext">
                  {hasConfiguredKey
                    ? 'Google Maps JavaScript API, Places API, and Directions are unlocked.'
                    : 'Zero-configuration mode active (CartoDB & Esri tiles). No API keys or billing required. Add your Google Maps API key below for official Google Cloud features.'}
                </p>
              </div>
            </div>
          </div>

          {/* Engine Preference Selector */}
          <div className="slider-control-card">
            <span className="slider-title">Map Engine Preference</span>
            <p className="slider-subtext">Choose how AccidentGuard renders automotive telemetry maps:</p>
            <div className="engine-toggle-grid">
              {(['auto', 'google', 'leaflet'] as MapEngine[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`engine-select-btn ${mapEngine === mode ? 'selected' : ''}`}
                  onClick={() => onSelectMapEngine?.(mode)}
                >
                  <span className="capitalize font-bold">
                    {mode === 'auto' ? '⚡ Auto' : mode === 'google' ? '🌐 Google Maps' : '🗺️ Leaflet (Free)'}
                  </span>
                  <span className="text-2xs text-slate-400 block mt-0.5">
                    {mode === 'auto' ? 'Prefers Google if key exists' : mode === 'google' ? 'Requires API Key' : 'No API key needed'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* MapTiler Cloud Key Configuration Card */}
          <div className="slider-control-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Globe size={16} className="text-cyan-400" />
                <span className="slider-title">MapTiler Cloud Key (High-Definition Tiles)</span>
              </div>
              {hasMapTilerKey && (
                <span className="text-xs text-emerald-400 flex items-center font-mono">
                  <CheckCircle2 size={13} className="mr-1" /> Active
                </span>
              )}
            </div>
            <p className="slider-subtext">
              Powers crisp 60fps automotive dark maps, streets, and satellite hybrid imagery with zero quota lag.
            </p>

            <div className="api-key-input-wrapper">
              <input
                type={showMapTilerKey ? 'text' : 'password'}
                className="contact-text-input font-mono text-xs pr-10"
                placeholder="p3XhDE..."
                value={mapTilerKeyInput}
                onChange={(e) => setMapTilerKeyInput(e.target.value)}
                id="input-maptiler-api-key"
              />
              <button
                type="button"
                className="toggle-visibility-btn"
                onClick={() => setShowMapTilerKey(!showMapTilerKey)}
                title={showMapTilerKey ? 'Hide key' : 'Show key'}
              >
                {showMapTilerKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {mapTilerSavedSuccess && (
              <div className="key-feedback-alert success">
                <Check size={14} className="mr-2 flex-shrink-0 text-emerald-400" />
                <span>MapTiler Cloud key saved & activated!</span>
              </div>
            )}

            <div className="api-key-actions mt-3">
              <button
                type="button"
                className="btn-save-key"
                onClick={handleSaveMapTilerKey}
                id="btn-save-maptiler-key"
              >
                <Check size={14} className="mr-1.5" />
                <span>Save MapTiler Key</span>
              </button>
              {hasMapTilerKey && (
                <button
                  type="button"
                  className="btn-clear-key"
                  onClick={handleClearMapTilerKey}
                  id="btn-clear-maptiler-key"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  <span>Reset Default</span>
                </button>
              )}
            </div>
          </div>

          {/* API Key Configuration Card */}
          <div className="slider-control-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Key size={16} className="text-cyan-400" />
                <span className="slider-title">Google Maps API Key</span>
              </div>
              {hasConfiguredKey && (
                <span className="text-xs text-emerald-400 flex items-center font-mono">
                  <CheckCircle2 size={13} className="mr-1" /> Key Configured
                </span>
              )}
            </div>
            <p className="slider-subtext">
              Enter your Google Cloud API key with Maps JavaScript API enabled. Keys are saved securely in your browser.
            </p>

            <div className="api-key-input-wrapper">
              <input
                type={showKey ? 'text' : 'password'}
                className="contact-text-input font-mono text-xs pr-10"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                id="input-google-maps-api-key"
              />
              <button
                type="button"
                className="toggle-visibility-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Test Status Messages */}
            {testStatus === 'testing' && (
              <div className="key-feedback-alert testing">
                <RefreshCw size={14} className="animate-spin mr-2 flex-shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}
            {testStatus === 'success' && (
              <div className="key-feedback-alert success">
                <CheckCircle2 size={14} className="mr-2 flex-shrink-0 text-emerald-400" />
                <span>{testMessage}</span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="key-feedback-alert error">
                <AlertCircle size={14} className="mr-2 flex-shrink-0 text-red-400" />
                <span>{testMessage}</span>
              </div>
            )}
            {savedSuccess && (
              <div className="key-feedback-alert success">
                <Check size={14} className="mr-2 flex-shrink-0 text-emerald-400" />
                <span>API Key configuration saved!</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="api-key-actions mt-3">
              <button
                type="button"
                className="btn-save-key"
                onClick={handleSaveApiKey}
                id="btn-save-google-key"
              >
                <Check size={14} className="mr-1.5" />
                <span>Save Key</span>
              </button>
              <button
                type="button"
                className="btn-test-key"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                id="btn-test-google-key"
              >
                <RefreshCw size={14} className={`mr-1.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>
              {hasConfiguredKey && (
                <button
                  type="button"
                  className="btn-clear-key"
                  onClick={handleClearApiKey}
                  id="btn-clear-google-key"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  <span>Clear Key</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Setup Checklist */}
          <div className="setup-guide-card">
            <div className="flex items-center space-x-2 mb-2">
              <Info size={16} className="text-cyan-400" />
              <h4 className="guide-title">How to obtain a Google Maps API Key</h4>
            </div>
            <ol className="guide-steps-list">
              <li>
                <strong>1. Create Google Cloud Project:</strong> Visit the{' '}
                <a
                  href="https://console.cloud.google.com/google/maps-apis"
                  target="_blank"
                  rel="noreferrer"
                  className="guide-link"
                >
                  Google Cloud Console <ExternalLink size={11} className="inline ml-0.5" />
                </a>.
              </li>
              <li>
                <strong>2. Enable Required APIs:</strong> In <em>APIs & Services &gt; Library</em>, enable:
                <div className="api-tag-row">
                  <span className="api-tag">Maps JavaScript API</span>
                  <span className="api-tag">Directions API</span>
                  <span className="api-tag">Places API</span>
                </div>
              </li>
              <li>
                <strong>3. Generate API Key:</strong> Go to <em>Credentials &gt; Create Credentials &gt; API Key</em>.
              </li>
              <li>
                <strong>4. Free Tier Note:</strong> Google provides <strong>$200 in free usage credits</strong> every month, allowing thousands of map loads and route requests at zero charge.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
