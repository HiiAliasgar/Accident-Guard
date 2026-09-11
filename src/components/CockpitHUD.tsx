// Cockpit Navigation HUD: Speedometer, Road Speed Limits, Active Road Alerts & Driving Controls
import React from 'react';
import { DrivingTelemetry, RoadAlert } from '../types';
import { 
  Gauge, 
  AlertTriangle, 
  Compass, 
  Navigation, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  ArrowUp, 
  ArrowDown, 
  Play, 
  Square,
  Radio,
  Zap,
  Clock,
  MapPin
} from 'lucide-react';

interface CockpitHUDProps {
  telemetry: DrivingTelemetry;
  activeAlert: RoadAlert | null;
  onAccelerate: () => void;
  onBrake: () => void;
  onCruise: () => void;
  onEmergencyStop: () => void;
  onToggleUnits: () => void;
}

export const CockpitHUD: React.FC<CockpitHUDProps> = ({
  telemetry,
  activeAlert,
  onAccelerate,
  onBrake,
  onCruise,
  onEmergencyStop,
  onToggleUnits
}) => {
  const {
    currentSpeedKmH,
    roadSpeedLimitKmH,
    isOverspeeding,
    currentRoadName,
    headingDeg,
    units,
    destinationName,
    routeEtaMinutes,
    routeDistanceKm
  } = telemetry;

  // Convert for display if mph selected
  const displaySpeed = units === 'mph' ? Math.round(currentSpeedKmH * 0.621371) : currentSpeedKmH;
  const displayLimit = units === 'mph' ? Math.round(roadSpeedLimitKmH * 0.621371) : roadSpeedLimitKmH;
  const speedDifference = displaySpeed - displayLimit;

  // Gauge calculation for circular progress arc (max 140 km/h)
  const maxScale = units === 'mph' ? 90 : 140;
  const speedPercent = Math.min(100, Math.round((displaySpeed / maxScale) * 100));
  const strokeDashoffset = 283 - (283 * speedPercent) / 100;

  // Compass cardinal direction
  const getCardinal = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
  };

  return (
    <div className="cockpit-hud-container">
      {/* Top Street & Navigation Banner */}
      <div className="cockpit-header-strip">
        <div className="road-info-block">
          <div className="road-indicator-chip">
            <Navigation size={14} className="text-cyan-400 rotate-45" />
            <span className="road-name">{currentRoadName}</span>
          </div>
          <div className="compass-pill">
            <Compass size={14} className="text-slate-400" />
            <span>{headingDeg}° {getCardinal(headingDeg)}</span>
          </div>
        </div>

        <div className="route-eta-chip">
          <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
            <span className="pulse-dot bg-emerald-400"></span>
            <span>Target: {destinationName.split(' ')[0]}</span>
          </div>
          <span className="eta-badge">
            <Clock size={12} className="inline mr-1" />
            ~{routeEtaMinutes} min • {routeDistanceKm} km
          </span>
        </div>
      </div>

      {/* Main Cockpit Telemetry Hub */}
      <div className="cockpit-gauges-grid">
        {/* SPEEDOMETER GAUGE */}
        <div className={`speedometer-card ${isOverspeeding ? 'overspeeding-alert' : ''}`}>
          <div className="speedometer-inner">
            {/* SVG Circular Dial Arc */}
            <div className="speed-dial-wrap">
              <svg className="speed-dial-svg" viewBox="0 0 120 120">
                <circle
                  className="dial-track"
                  cx="60"
                  cy="60"
                  r="45"
                />
                <circle
                  className={`dial-indicator ${isOverspeeding ? 'danger' : ''}`}
                  cx="60"
                  cy="60"
                  r="45"
                  style={{ strokeDashoffset }}
                />
              </svg>
              
              {/* Digital Readout */}
              <div className="speed-readout">
                <span className="speed-value">{displaySpeed}</span>
                <button
                  type="button"
                  className="speed-unit-toggle"
                  onClick={onToggleUnits}
                  title="Toggle km/h and mph"
                >
                  {units}
                </button>
              </div>
            </div>

            <div className="speed-status-label">
              {displaySpeed === 0 ? (
                <span className="status-idle">VEHICLE STOPPED</span>
              ) : isOverspeeding ? (
                <span className="status-danger animate-pulse">OVERSPEED WARNING</span>
              ) : (
                <span className="status-optimal">OPTIMAL CRUISE</span>
              )}
            </div>
          </div>
        </div>

        {/* ROAD SPEED LIMIT SIGN & SAFETY ADVISORY */}
        <div className="road-limit-card">
          <div className="limit-sign-wrapper">
            {/* Standard Circular Speed Limit Traffic Sign */}
            <div className={`traffic-speed-sign ${isOverspeeding ? 'sign-overspeed-pulsing' : ''}`}>
              <div className="sign-outer-ring">
                <div className="sign-inner-white">
                  <span className="sign-speed-number">{displayLimit}</span>
                  <span className="sign-subtext">{units}</span>
                </div>
              </div>
            </div>

            <div className="limit-details">
              <span className="limit-title">ROAD SPEED LIMIT</span>
              {isOverspeeding ? (
                <div className="limit-warning-badge">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span>+{speedDifference} {units} over limit</span>
                </div>
              ) : (
                <div className="limit-safe-badge">
                  <span>Within Safety Threshold</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PROACTIVE ROAD HAZARD ALERT BANNER */}
      {activeAlert && (
        <div className={`road-hazard-banner ${activeAlert.severity.toLowerCase()}`}>
          <div className="hazard-banner-icon">
            <AlertTriangle size={24} className={activeAlert.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <div className="hazard-banner-body">
            <div className="hazard-top-row">
              <span className="hazard-badge-type">{activeAlert.type.replace('_', ' ')}</span>
              <span className="hazard-distance-badge">
                {activeAlert.distanceMeters > 0 ? `In ${activeAlert.distanceMeters}m` : 'Nearby'}
              </span>
            </div>
            <h3 className="hazard-title">{activeAlert.title}</h3>
            <p className="hazard-desc">{activeAlert.description}</p>
            {activeAlert.recommendedSpeedKmH && (
              <div className="hazard-advisory-pill">
                <span>Advisory Speed:</span>
                <strong>{activeAlert.recommendedSpeedKmH} km/h</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE DRIVING SIMULATOR CONTROLS */}
      <div className="driving-controls-panel">
        <div className="controls-header">
          <span className="controls-title">
            <Radio size={14} className="inline mr-1 text-cyan-400" />
            Driving Dynamics & Throttle Control
          </span>
          <span className="controls-hint">Simulate real-time vehicle speed & telemetry</span>
        </div>

        <div className="controls-buttons-grid">
          <button
            type="button"
            className="drive-btn accel-btn"
            onClick={onAccelerate}
            id="btn-accelerate"
          >
            <ArrowUp size={16} />
            <span>Accelerate (+10)</span>
          </button>

          <button
            type="button"
            className="drive-btn cruise-btn"
            onClick={onCruise}
            id="btn-cruise"
          >
            <Play size={16} />
            <span>Match Limit ({displayLimit})</span>
          </button>

          <button
            type="button"
            className="drive-btn brake-btn"
            onClick={onBrake}
            id="btn-brake"
          >
            <ArrowDown size={16} />
            <span>Brake (-15)</span>
          </button>

          <button
            type="button"
            className="drive-btn stop-btn"
            onClick={onEmergencyStop}
            id="btn-stop"
          >
            <Square size={16} />
            <span>Full Stop</span>
          </button>
        </div>
      </div>
    </div>
  );
};
