import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { getCurrentCoordinates, DEFAULT_HOSPITALS, getSortedHospitals, Coordinates, generateEmergencySmsPayload } from './services/locationService';
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
  Activity,
  Sliders,
  History,
  Cpu,
  Maximize2,
  Minimize2,
  Navigation,
  Radio,
  Zap,
  Volume2,
  VolumeX,
  Hospital as HospitalIcon,
  Wifi,
  WifiOff
} from 'lucide-react';
import { emergencyAudio } from './services/audioService';
import { hardwareService } from './services/hardwareService';

const INITIAL_CONTACTS: EmergencyContact[] = [
  {
    id: 'contact-1',
    name: 'Sarah Mercer',
    relationship: 'Spouse',
    phone: '+1 (415) 555-0192',
    isPrimary: true
  },
  {
    id: 'contact-2',
    name: 'Dr. Michael Chen',
    relationship: 'Family Physician',
    phone: '+1 (415) 555-8833',
    isPrimary: false
  }
];

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'navigation' | 'sensors' | 'hospitals' | 'history' | 'settings'>('navigation');

  // Core Crash Detection System State
  const [status, setStatus] = useState<SystemStatus>('NORMAL');
  const [currentPoint, setCurrentPoint] = useState<SensorDataPoint | null>(null);
  const [thresholds, setThresholds] = useState<DetectionThresholds>(DEFAULT_THRESHOLDS);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(DEFAULT_THRESHOLDS.countdownDurationSec);
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
  const scenarioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Location & Hospitals
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>(DEFAULT_HOSPITALS);
  const [contacts, setContacts] = useState<EmergencyContact[]>(INITIAL_CONTACTS);

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
    hardwareService.acquireWakeLock();
    const unsubNet = hardwareService.subscribeNetworkStatus((online) => {
      setIsOnline(online);
    });
    return () => {
      unsubNet();
      hardwareService.releaseWakeLock();
    };
  }, []);

  // Cleanup scenario timeout on unmount
  useEffect(() => {
    return () => {
      if (scenarioTimeoutRef.current !== null) {
        clearTimeout(scenarioTimeoutRef.current);
      }
    };
  }, []);

  // Initialize GPS Coordinates and Hospitals
  useEffect(() => {
    getCurrentCoordinates()
      .then((pos) => {
        setCoords(pos);
        setLocationError(null);
        const sorted = getSortedHospitals(pos, DEFAULT_HOSPITALS);
        setHospitals(sorted);
        navigationService.setDestinationHospital(sorted[0]);
      })
      .catch((err) => {
        setLocationError(err instanceof Error ? err.message : 'GPS location unavailable');
      });
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

  // Sensor Subscription Pipeline (~50Hz) & Source Sync
  useEffect(() => {
    const unsubscribe = sensorService.subscribe((point) => {
      setCurrentPoint(point);
      crashDetector.processSensorFrame(point);
    });
    const unsubSource = sensorService.onSourceChange((sim) => {
      setIsSimulated(sim);
    });
    return () => {
      unsubscribe();
      unsubSource();
    };
  }, []);

  const nearestHospital = hospitals[0] || DEFAULT_HOSPITALS[0];
  const favoriteContact = useMemo(
    () => contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null,
    [contacts]
  );

  const triggerFavoriteContactSms = useCallback((incidentOverride?: IncidentRecord | null) => {
    if (!favoriteContact || typeof window === 'undefined') return false;

    const activeIncident = incidentOverride ?? currentIncident;
    const effectiveCoords = activeIncident?.location
      ? { latitude: activeIncident.location.lat, longitude: activeIncident.location.lng, accuracy: activeIncident.location.accuracy }
      : coords;
    if (!effectiveCoords) return false;

    const payload = generateEmergencySmsPayload({
      userName: favoriteContact.name,
      coords: effectiveCoords,
      peakG: activeIncident?.peakG ?? 0,
      nearestHospital,
      timestamp: activeIncident?.timestamp ?? Date.now()
    });

    const normalizedPhone = favoriteContact.phone.replace(/[^\d+]/g, '');
    const smsHref = normalizedPhone
      ? `sms:${normalizedPhone}?body=${encodeURIComponent(payload.messageText)}`
      : `sms:?body=${encodeURIComponent(payload.messageText)}`;

    window.location.href = smsHref;
    return true;
  }, [coords, currentIncident, favoriteContact, nearestHospital]);

  // Crash Detector Event Listeners
  useEffect(() => {
    const unsubState = crashDetector.onStateChange((newState, incident) => {
      setStatus(newState);
      if (incident) {
        setCurrentIncident(incident);
      }
      setIncidents(crashDetector.getIncidentHistory());

      if ((newState === 'ALERT_TRIGGERED' || newState === 'DISPATCHED') && incident) {
        triggerFavoriteContactSms(incident);
      }

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
  }, [triggerFavoriteContactSms]);

  // Handle Simulation Triggers
  const handleTriggerScenario = useCallback((scenario: SimulationScenario) => {
    setActiveScenario(scenario);
    sensorService.triggerScenario(scenario);
    if (scenarioTimeoutRef.current !== null) {
      clearTimeout(scenarioTimeoutRef.current);
    }
    scenarioTimeoutRef.current = setTimeout(() => {
      setActiveScenario('NONE');
      scenarioTimeoutRef.current = null;
    }, 5500);
  }, []);

  const handleToggleSensorSource = useCallback(async () => {
    if (isSimulated) {
      await sensorService.setIsSimulated(false);
    } else {
      await sensorService.setIsSimulated(true);
    }
  }, [isSimulated]);

  const handleManualEmergency = useCallback(() => {
    crashDetector.triggerManualCrashDemo();
  }, []);

  const handleCancelAlert = useCallback(() => {
    crashDetector.cancelAlarmByUser();
  }, []);

  const handleTriggerImmediateDispatch = useCallback(() => {
    void crashDetector.triggerImmediateDispatch();
  }, []);

  const handleResetToNormal = useCallback(() => {
    crashDetector.reset();
    setStatus('NORMAL');
    setCurrentIncident(null);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMute = !prev;
      emergencyAudio.setMuted(nextMute);
      return nextMute;
    });
  }, []);

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

  const handleAddContact = useCallback((c: EmergencyContact) => {
    setContacts((prev) => [...prev, c]);
  }, []);

  const handleDeleteContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const statusBadge = useMemo(() => {
    switch (status) {
      case 'NORMAL':
      case 'CANCELLED':
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
          <div className="status-pill warning animate-pulse">
            <span className="pulse-dot bg-amber-400"></span>
            <span>VERIFYING POST-IMPACT STILLNESS</span>
          </div>
        );
      case 'COUNTDOWN':
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
            <span>SOS ALERT PREVIEW — NO DISPATCH</span>
          </div>
        );
    }
  }, [status, countdownRemaining]);

  return (
    <div className={`app-root ${isMobileFrame ? 'mobile-framed' : 'full-width'}`}>
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
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={16} className="text-slate-400" /> : <Volume2 size={16} className="text-emerald-400" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>

          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setShowMLModal(true)}
            title="View Algorithm & ML Architecture Specs"
          >
            <Cpu size={16} className="text-cyan-400 mr-1.5" />
            <span className="hidden sm:inline">ML Specs</span>
          </button>

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

      <div className="device-viewport-shell">
        <div className="device-screen-surface">
          <div className="app-status-bar">
            {statusBadge}

            <button
              type="button"
              className="sensor-toggle-btn"
              onClick={handleToggleSensorSource}
              title={isSimulated ? 'Switch to Device Hardware Sensors' : 'Switch to Physics Simulator'}
            >
              <Radio size={12} className={`mr-1 ${isSimulated ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span>{isSimulated ? `Sim (${sensorService.getSamplingRate()}Hz)` : `Hardware (${sensorService.getSamplingRate()}Hz)`}</span>
            </button>

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

          <main className="main-content-scrollable">
            {currentTab === 'navigation' && (
              <div className="cockpit-view-content">
                <div className="cockpit-map-card">
                  <MapView
                    key={`map-nav-${mapKeyRevision}-${mapEngine}`}
                    latitude={telemetry.currentLocation.latitude}
                    longitude={telemetry.currentLocation.longitude}
                    heading={telemetry.headingDeg}
                    speedKmH={telemetry.currentSpeedKmH}
                    hospitals={hospitals}
                    roadAlerts={roadAlerts}
                    routeCoordinates={DEFAULT_ROUTE_COORDINATES}
                    roadName={telemetry.currentRoadName}
                    height="320px"
                    zoom={15}
                    isCockpitMode={true}
                    engine={mapEngine}
                    onEngineToggle={handleSelectMapEngine}
                    onOpenSettings={() => setCurrentTab('settings')}
                  />
                </div>

                <CockpitHUD
                  telemetry={telemetry}
                  activeAlert={activeRoadAlert}
                  onAccelerate={() => navigationService.accelerate(10)}
                  onBrake={() => navigationService.brake(15)}
                  onCruise={() => navigationService.cruise()}
                  onEmergencyStop={() => navigationService.emergencyStop()}
                  onToggleUnits={() => navigationService.toggleUnits()}
                />

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

            {currentTab === 'sensors' && (
              <div className="dashboard-view-content">
                <SensorGraph currentPoint={currentPoint} historyLimit={150} />
                <GForceMeter
                  currentPoint={currentPoint}
                  impactThreshold={thresholds.impactThresholdG}
                />
                <SimulationControls
                  currentScenario={activeScenario}
                  onTriggerScenario={handleTriggerScenario}
                  onTriggerManualEmergency={handleManualEmergency}
                />
              </div>
            )}

            {currentTab === 'hospitals' && (
              <div className="map-tab-content">
                <div className="map-banner mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white">Trauma Centers & EMS Coverage</h2>
                      <p className="text-xs text-slate-400">
                        {coords
                          ? `GPS: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} (${typeof coords.accuracy === 'number' ? `±${Math.round(coords.accuracy)}m` : 'accuracy unavailable'})`
                          : (locationError || 'GPS location unavailable (demo facilities shown)')}
                      </p>
                    </div>
                    <span className="hospital-count-badge">{hospitals.length} Centers</span>
                  </div>
                </div>

                <MapView
                  key={`map-hosp-${mapKeyRevision}-${mapEngine}`}
                  latitude={coords?.latitude ?? hospitals[0].latitude}
                  longitude={coords?.longitude ?? hospitals[0].longitude}
                  hospitals={hospitals}
                  roadAlerts={roadAlerts}
                  roadName={telemetry.currentRoadName}
                  height="260px"
                  zoom={13}
                  engine={mapEngine}
                  onEngineToggle={handleSelectMapEngine}
                  onOpenSettings={() => setCurrentTab('settings')}
                />

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
                          <div className="text-xs text-slate-400">{hosp.distanceKm ?? '—'} km</div>
                        </div>
                      </div>
                      <div className="mini-card-actions mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-xs text-slate-400">{hosp.traumaLevel}</span>
                        {hosp.phone ? (
                          <a href={`tel:${hosp.phone}`} className="mini-call-link">
                            📞 Call ER Desk
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Demo Fixture</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

      {status === 'COUNTDOWN' && (
        <AlertScreen
          countdownSeconds={countdownRemaining}
          maxCountdownSeconds={thresholds.countdownDurationSec}
          peakG={currentIncident?.peakG ?? 4.8}
          peakGyro={currentIncident?.peakRotation ?? 280}
          latitude={coords?.latitude ?? nearestHospital.latitude}
          longitude={coords?.longitude ?? nearestHospital.longitude}
          nearestHospital={nearestHospital}
          onCancel={handleCancelAlert}
          onTriggerImmediateDispatch={handleTriggerImmediateDispatch}
        />
      )}

      {(status === 'ALERT_TRIGGERED' || status === 'DISPATCHED') && (
        <DispatchScreen
          incident={currentIncident}
          coords={coords}
          nearestHospital={nearestHospital}
          contacts={contacts}
          onResetToNormal={handleResetToNormal}
        />
      )}

      <MLReferenceModal
        isOpen={showMLModal}
        onClose={() => setShowMLModal(false)}
      />
    </div>
  );
};
