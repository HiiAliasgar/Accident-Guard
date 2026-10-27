// Main Application Shell for AccidentGuard: Google Maps Navigation, Road Speed & Hazards HUD, and Direct Hospital Dispatch
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  SystemStatus, 
  SensorDataPoint, 
  DetectionThresholds, 
  EmergencyContact, 
  Hospital, 
  IncidentRecord, 
  SimulationScenario,
  DrivingTelemetry,
  RoadAlert,
  MapEngine
} from './types';
import { sensorService } from './services/sensorService';
import { crashDetector, DEFAULT_THRESHOLDS } from './services/crashDetector';
import { getCurrentCoordinates, DEFAULT_HOSPITALS, getSortedHospitals, Coordinates } from './services/locationService';
import { navigationService, DEFAULT_ROUTE_COORDINATES } from './services/navigationService';

// Subcomponents
import { CockpitHUD } from './components/CockpitHUD';
import { SensorGraph } from './components/SensorGraph';
import { GForceMeter } from './components/GForceMeter';
import { AlertScreen } from './components/AlertScreen';
import { DispatchScreen } from './components/DispatchScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { SimulationControls } from './components/SimulationControls';
import { EventLogList } from './components/EventLogList';
import { MapView } from './components/MapView';
import { MLReferenceModal } from './components/MLReferenceModal';

// Icons
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Sliders, 
  MapPin, 
  History, 
  Cpu, 
  Maximize2, 
  Minimize2,
  Navigation,
  Radio,
  AlertTriangle,
  Zap,
  Volume2,
  VolumeX,
  Hospital as HospitalIcon,
  Wifi,
  WifiOff
} from 'lucide-react';
import { emergencyAudio } from './services/audioService';
import { hardwareService } from './services/hardwareService';

export const App: React.FC = () => {
  // Navigation Tabs: Cockpit Navigation (Default), Sensors Telemetry, Hospitals, History, Settings
  const [currentTab, setCurrentTab] = useState<'navigation' | 'sensors' | 'hospitals' | 'history' | 'settings'>('navigation');

  // Core Crash Detection System State
  const [status, setStatus] = useState<SystemStatus>('NORMAL');
  const [currentPoint, setCurrentPoint] = useState<SensorDataPoint | null>(null);
  const [thresholds, setThresholds] = useState<DetectionThresholds>(DEFAULT_THRESHOLDS);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(15);
  const [currentIncident, setCurrentIncident] = useState<IncidentRecord | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);

  // Driving & Road Navigation State
  const [telemetry, setTelemetry] = useState<DrivingTelemetry>(navigationService.getTelemetry());
  const [activeRoadAlert, setActiveRoadAlert] = useState<RoadAlert | null>(navigationService.getActiveAlert());
  const [roadAlerts, setRoadAlerts] = useState<RoadAlert[]>(navigationService.getRoadAlerts());

  // Simulation & Device settings
  const [isSimulated, setIsSimulated] = useState<boolean>(sensorService.getIsSimulated());
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>('NONE');
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(true);
  const [showMLModal, setShowMLModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(emergencyAudio.getIsMuted());

  // Location & Hospitals
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string>('Location has not been acquired.');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => {
    try {
      const saved = localStorage.getItem('accidentguard_emergency_contacts');
      return saved ? (JSON.parse(saved) as EmergencyContact[]) : [];
    } catch {
      return [];
    }
  });

  // Map Engine & API Key State
  const [mapEngine, setMapEngine] = useState<MapEngine>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('accidentguard_map_engine') as MapEngine;
      if (saved === 'auto' || saved === 'google' || saved === 'leaflet') return saved;
    }
    return 'auto';
  });
  const [mapKeyRevision, setMapKeyRevision] = useState<number>(0);

  const handleSelectMapEngine = (engine: MapEngine) => {
    setMapEngine(engine);
    if (typeof window !== 'undefined') {
      localStorage.setItem('accidentguard_map_engine', engine);
    }
  };

  const handleApiKeySaved = () => {
    setMapKeyRevision((prev) => prev + 1);
  };

  // Hardware Driver Safety: Screen WakeLock & Network Connectivity Monitor
  const [isOnline, setIsOnline] = useState<boolean>(() => hardwareService.isOnline());

  useEffect(() => {
    // Acquire Screen WakeLock so screen and sensor loop stay active while driving
    hardwareService.acquireWakeLock();
    const unsubNet = hardwareService.subscribeNetworkStatus((online) => {
      setIsOnline(online);
    });
    return () => {
      unsubNet();
      hardwareService.releaseWakeLock();
    };
  }, []);

  // Initialize GPS Coordinates and Hospitals
  useEffect(() => {
    let active = true;
    getCurrentCoordinates().then((pos) => {
      if (!active) return;
      setCoords(pos);
      setLocationError('');
    }).catch((error: unknown) => {
      if (!active) return;
      setCoords(null);
      setLocationError(error instanceof Error ? error.message : 'Location unavailable.');
    });
    return () => { active = false; };
  }, []);

  // Subscribe to Navigation & Driving Telemetry Updates
  useEffect(() => {
    const unsubscribeNav = navigationService.subscribe((newTelem, alert, allAlerts) => {
      setTelemetry(newTelem);
      setActiveRoadAlert(alert);
      setRoadAlerts(allAlerts);
    });
    return () => unsubscribeNav();
  }, []);

  // Sensor Subscription Pipeline (~50Hz)
  useEffect(() => {
    const unsubscribe = sensorService.subscribe((point) => {
      setCurrentPoint(point);
      setIsSimulated(sensorService.getIsSimulated());
      crashDetector.processSensorFrame(point);
    });
    return () => unsubscribe();
  }, []);

  // Crash Detector Event Listeners
  useEffect(() => {
    const unsubState = crashDetector.onStateChange((newState, incident) => {
      setStatus(newState);
      if (incident) {
        setCurrentIncident(incident);
      }
      setIncidents(crashDetector.getIncidentHistory());
      // Trigger native tactile haptic vibration on emergency transitions
      if (newState === 'IMPACT_DETECTED' || newState === 'CONFIRMING' || newState === 'ALERT_TRIGGERED') {
        hardwareService.triggerEmergencyVibration();
      }
    });

    const unsubTick = crashDetector.onCountdownTick((remaining) => {
      setCountdownRemaining(remaining);
    });

    return () => {
      unsubState();
      unsubTick();
    };
  }, []);

  // Handle Simulation Triggers
  const handleTriggerScenario = useCallback((scenario: SimulationScenario) => {
    setActiveScenario(scenario);
    sensorService.triggerScenario(scenario);
    setTimeout(() => {
      setActiveScenario('NONE');
    }, 5500);
  }, []);

  // Manual direct emergency countdown
  const handleManualEmergency = useCallback(() => {
    crashDetector.triggerManualCrashDemo();
  }, []);

  // User Cancelled ("I'm OK")
  const handleCancelAlert = useCallback(() => {
    crashDetector.cancelAlarmByUser();
  }, []);

  // Immediate dispatch (skip countdown)
  const handleTriggerImmediateDispatch = useCallback(() => {
    setStatus('DISPATCHED');
  }, []);

  // Reset from dispatch back to normal
  const handleResetToNormal = useCallback(() => {
    setStatus('NORMAL');
    setCurrentIncident(null);
  }, []);

  // Audio mute toggle (functional updater avoids isMuted dependency)
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMute = !prev;
      emergencyAudio.setMuted(nextMute);
      return nextMute;
    });
  }, []);

  // Sensitivity updates & optimizations
  const handleUpdateThresholds = useCallback((newThresholds: Partial<DetectionThresholds>) => {
    crashDetector.updateThresholds(newThresholds);
    const updated = crashDetector.getThresholds();
    setThresholds(updated);

    if (newThresholds.adaptiveSampling !== undefined) {
      sensorService.setAdaptiveSampling(newThresholds.adaptiveSampling);
    }
    if (newThresholds.powerSaverMode !== undefined) {
      sensorService.setPowerSaverMode(newThresholds.powerSaverMode);
    }
  }, []);

  // Contacts management
  const handleAddContact = useCallback((c: EmergencyContact) => {
    setContacts((prev) => {
      const next = [...prev.filter((item) => item.id !== c.id), c];
      localStorage.setItem('accidentguard_emergency_contacts', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleDeleteContact = useCallback((id: string) => {
    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      localStorage.setItem('accidentguard_emergency_contacts', JSON.stringify(next));
      return next;
    });
  }, []);

  const nearestHospital = hospitals[0] || null;

  // Helper status color and text badge (memoized to avoid re-computation on unrelated renders)
  const statusBadge = useMemo(() => {
    switch (status) {
      case 'NORMAL':
        return (
          <div className="status-pill safe">
            <span className="pulse-dot bg-emerald-400"></span>
            <span>SYSTEM MONITORING • ROAD SAFE</span>
          </div>
        );
      case 'IMPACT_DETECTED':
        return (
          <div className="status-pill warning animate-pulse">
            <span className="pulse-dot bg-amber-400"></span>
            <span>IMPACT DETECTED — ANALYZING STILLNESS</span>
          </div>
        );
      case 'CONFIRMING':
        return (
          <div className="status-pill alert animate-bounce">
            <span className="pulse-dot bg-red-400"></span>
            <span>EMERGENCY SOS COUNTDOWN ({countdownRemaining}s)</span>
          </div>
        );
      case 'ALERT_TRIGGERED':
      case 'DISPATCHED':
        return (
          <div className="status-pill danger">
            <span className="pulse-dot bg-red-500"></span>
            <span>TRAUMA DISPATCH ACTIVE</span>
          </div>
        );
    }
  }, [status, countdownRemaining]);

  return (
    <div className={`app-root ${isMobileFrame ? 'mobile-framed' : 'full-width'}`}>
      {/* Top System Toolbar */}
      <header className="system-top-toolbar">
        <div className="brand-group">
          <div className="brand-logo">
            <ShieldCheck size={22} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="brand-name">AccidentGuard</h1>
            <span className="brand-version">Automotive Telemetry & Hospital SOS</span>
          </div>
        </div>

        <div className="toolbar-controls">
          {/* Audio Mute Toggle */}
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={16} className="text-slate-400" /> : <Volume2 size={16} className="text-emerald-400" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>

          {/* ML Specs Button */}
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setShowMLModal(true)}
            title="View Algorithm & ML Architecture Specs"
          >
            <Cpu size={16} className="text-cyan-400 mr-1.5" />
            <span className="hidden sm:inline">ML Specs</span>
          </button>

          {/* Mobile Frame Toggle */}
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            title={isMobileFrame ? 'Expand to Full Cockpit View' : 'Switch to Smartphone Bezel Frame'}
          >
            {isMobileFrame ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            <span className="hidden sm:inline">{isMobileFrame ? 'Wide Cockpit' : 'Phone Frame'}</span>
          </button>
        </div>
      </header>

      {/* Main Container / Smartphone Shell */}
      <div className="device-viewport-shell">
        <div className="device-screen-surface">
          {/* In-App Status Header */}
          <div className="app-status-bar">
            {statusBadge}
            
            <div className="sensor-source-indicator">
              <span className="text-xs text-slate-400 flex items-center">
                <Radio size={12} className={`mr-1 ${isSimulated ? 'text-amber-400' : 'text-emerald-400'}`} />
                {isSimulated ? `Sim (${sensorService.getSamplingRate()}Hz)` : `Hardware (${sensorService.getSamplingRate()}Hz)`}
              </span>
            </div>

            <div className="network-source-indicator ml-2">
              <span className="text-xs text-slate-400 flex items-center">
                {isOnline ? (
                  <Wifi size={12} className="mr-1 text-emerald-400" />
                ) : (
                  <WifiOff size={12} className="mr-1 text-amber-400" />
                )}
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* MAIN TAB CONTENT */}
          <main className="main-content-scrollable">
            {/* 1. COCKPIT NAVIGATION & GOOGLE MAPS HUD */}
            {currentTab === 'navigation' && (
              <div className="cockpit-view-content">
                {/* Show the map only after the device has supplied a real location. */}
                <div className="cockpit-map-card">
                  {coords ? (
                    <MapView
                      key={`map-nav-${mapKeyRevision}-${mapEngine}`}
                      latitude={coords.latitude}
                      longitude={coords.longitude}
                      heading={0}
                      speedKmH={0}
                      hospitals={[]}
                      roadAlerts={[]}
                      routeCoordinates={[]}
                      height="320px"
                      zoom={15}
                      isCockpitMode={true}
                      engine={mapEngine}
                      onEngineToggle={handleSelectMapEngine}
                      onOpenSettings={() => setCurrentTab('settings')}
                    />
                  ) : (
                    <div role="status" className="p-5 text-sm text-slate-300">
                      <h2 className="text-base font-semibold text-white">Current location unavailable</h2>
                      <p className="mt-2">{locationError}</p>
                      <p className="mt-2">Grant location permission and reload to show your position. Route distance, ETA, road name, traffic and vehicle speed are unavailable until a real provider supplies them.</p>
                      <a className="inline-block mt-3 underline" href="https://www.google.com/maps" target="_blank" rel="noreferrer">Open Google Maps</a>
                    </div>
                  )}
                </div>

                <section className="p-4 rounded-xl border border-slate-700 bg-slate-900/60" aria-label="Navigation status">
                  <h2 className="font-semibold text-white">Navigation provider not configured</h2>
                  <p className="mt-2 text-sm text-slate-300">Live road routing is not currently connected. Route distance, ETA, speed limits, live traffic and road hazards are intentionally unavailable instead of simulated.</p>
                  <p className="mt-2 text-xs text-amber-300">Crash detection is experimental and has not been safety-validated.</p>
                </section>

                {/* Quick Crash Simulator Launcher Bar */}
                <div className="quick-sim-bar">
                  <div className="quick-sim-title">
                    <Zap size={14} className="text-amber-400 inline mr-1" />
                    <span>Trigger Impact Simulations for Testing</span>
                  </div>
                  <div className="quick-sim-buttons">
                    <button
                      type="button"
                      className="quick-sim-btn crash-btn"
                      onClick={() => handleTriggerScenario('HEAD_ON_COLLISION')}
                    >
                      💥 4.8g Crash Impact
                    </button>
                    <button
                      type="button"
                      className="quick-sim-btn drop-btn"
                      onClick={() => handleTriggerScenario('PHONE_DROP_REJECTION')}
                    >
                      📱 Phone Drop (Reject)
                    </button>
                    <button
                      type="button"
                      className="quick-sim-btn bump-btn"
                      onClick={() => handleTriggerScenario('SPEED_BUMP_POTHOLE')}
                    >
                      🚗 Speed Bump (Safe)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SENSORS & ACCELEROMETER TELEMETRY */}
            {currentTab === 'sensors' && (
              <div className="dashboard-view-content">
                {/* Real-time Oscilloscope Waveform */}
                <SensorGraph currentPoint={currentPoint} historyLimit={150} />

                {/* G-Force Telemetry Card */}
                <GForceMeter
                  currentPoint={currentPoint}
                  impactThreshold={thresholds.impactThresholdG}
                />

                {/* Full Simulation Test Bench */}
                <SimulationControls
                  currentScenario={activeScenario}
                  onTriggerScenario={handleTriggerScenario}
                  onTriggerManualEmergency={handleManualEmergency}
                />
              </div>
            )}

            {/* 3. HOSPITAL ROUTING & EMERGENCY COVERAGE */}
            {currentTab === 'hospitals' && (
              <div className="map-tab-content">
                <div className="map-banner mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white">Trauma Centers & EMS Coverage</h2>
                      <p className="text-xs text-slate-400">
                        {coords ? `GPS: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} (accuracy ±${Math.round(coords.accuracy ?? 0)}m)` : `GPS unavailable: ${locationError}`}
                      </p>
                    </div>
                    <span className="hospital-count-badge">{hospitals.length} Centers</span>
                  </div>
                </div>

                {coords ? (
                  <MapView
                    key={`map-hosp-${mapKeyRevision}-${mapEngine}`}
                    latitude={coords.latitude}
                    longitude={coords.longitude}
                    hospitals={[]}
                    roadAlerts={[]}
                    height="260px"
                    zoom={13}
                    engine={mapEngine}
                    onEngineToggle={handleSelectMapEngine}
                    onOpenSettings={() => setCurrentTab('settings')}
                  />
                ) : (
                  <p role="status" className="p-4 text-sm text-slate-300">Location unavailable: {locationError}</p>
                )}

                <div className="nearby-hospitals-scroll mt-3">
                  {hospitals.map((hosp, idx) => (
                    <div key={hosp.id} className="hospital-card-mini">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs text-cyan-400 font-mono">Rank #{idx + 1}</span>
                          <h3 className="text-sm font-bold text-white">{hosp.name}</h3>
                          <p className="text-xs text-slate-400">{hosp.address}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold text-sm">~{hosp.etaMinutes ?? 5} min</span>
                          <div className="text-xs text-slate-400">{hosp.distanceKm} km</div>
                        </div>
                      </div>
                      <div className="mini-card-actions mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-xs text-slate-400">{hosp.traumaLevel}</span>
                        <a href={`tel:${hosp.phone}`} className="mini-call-link">
                          📞 Call ER Desk
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. SETTINGS SCREEN */}
            {currentTab === 'settings' && (
              <SettingsScreen
                thresholds={thresholds}
                onUpdateThresholds={handleUpdateThresholds}
                contacts={contacts}
                onAddContact={handleAddContact}
                onDeleteContact={handleDeleteContact}
                hospitals={hospitals}
                mapEngine={mapEngine}
                onSelectMapEngine={handleSelectMapEngine}
                onApiKeySaved={handleApiKeySaved}
              />
            )}

            {/* 5. INCIDENT LOG HISTORY */}
            {currentTab === 'history' && (
              <div className="history-tab-content">
                <div className="history-header mb-3">
                  <h2 className="text-sm font-bold text-white">All Recorded Safety Incidents</h2>
                  <span className="text-xs text-slate-400">{incidents.length} total events</span>
                </div>
                <EventLogList incidents={incidents} />
              </div>
            )}
          </main>

          {/* Bottom Navigation Bar */}
          <nav className="app-bottom-nav">
            <button
              type="button"
              className={`nav-item ${currentTab === 'navigation' ? 'active' : ''}`}
              onClick={() => setCurrentTab('navigation')}
              id="tab-navigation"
            >
              <Navigation size={20} />
              <span>Drive HUD</span>
            </button>

            <button
              type="button"
              className={`nav-item ${currentTab === 'sensors' ? 'active' : ''}`}
              onClick={() => setCurrentTab('sensors')}
              id="tab-sensors"
            >
              <Activity size={20} />
              <span>Sensors</span>
            </button>

            <button
              type="button"
              className={`nav-item ${currentTab === 'hospitals' ? 'active' : ''}`}
              onClick={() => setCurrentTab('hospitals')}
              id="tab-hospitals"
            >
              <HospitalIcon size={20} />
              <span>Hospitals</span>
            </button>

            <button
              type="button"
              className={`nav-item ${currentTab === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentTab('history')}
              id="tab-history"
            >
              <History size={20} />
              <span>Log</span>
            </button>

            <button
              type="button"
              className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentTab('settings')}
              id="tab-settings"
            >
              <Sliders size={20} />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </div>

      {/* FULL-SCREEN URGENT ALERT SCREEN (TRIGGERED DURING COUNTDOWN) */}
      {status === 'CONFIRMING' && (
        <AlertScreen
          countdownSeconds={countdownRemaining}
          maxCountdownSeconds={thresholds.countdownDurationSec}
          peakG={currentIncident?.peakG ?? 0}
          peakGyro={currentIncident?.peakRotation ?? 0}
          latitude={coords?.latitude ?? null}
          longitude={coords?.longitude ?? null}
          nearestHospital={nearestHospital}
          onCancel={handleCancelAlert}
          onTriggerImmediateDispatch={handleTriggerImmediateDispatch}
        />
      )}

      {/* EMERGENCY DISPATCH ACTIVE SCREEN (DIRECT HOSPITAL NOTIFICATIONS & TELEMETRY) */}
      {(status === 'ALERT_TRIGGERED' || status === 'DISPATCHED') && (
        <DispatchScreen
          incident={currentIncident}
          coords={coords}
          nearestHospital={nearestHospital}
          contacts={contacts}
          onResetToNormal={handleResetToNormal}
        />
      )}

      {/* ML Architecture Modal */}
      <MLReferenceModal
        isOpen={showMLModal}
        onClose={() => setShowMLModal(false)}
      />
    </div>
  );
};
