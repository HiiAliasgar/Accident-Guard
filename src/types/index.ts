// Type definitions for AccidentGuard

export type SystemStatus = 
  | 'NORMAL'           // Safe baseline driving/idle
  | 'IMPACT_DETECTED'  // High G spike above threshold detected
  | 'CONFIRMING'       // Post-impact stillness & orientation verification window
  | 'ALERT_TRIGGERED'  // Emergency countdown finished without cancellation
  | 'DISPATCHED';      // Emergency SMS & Call intent sent to trauma dispatch

export interface SensorDataPoint {
  timestamp: number;
  // Linear Acceleration (m/s² or g, normalized to g where 1g ≈ 9.81 m/s²)
  x: number;
  y: number;
  z: number;
  // Resultant magnitude: sqrt(x² + y² + z²)
  magnitude: number;
  // Dynamic acceleration (deviation from 1g earth gravity): |magnitude - 1.0|
  dynamicAcceleration: number;
  // Gyroscope rotation rate (deg/s)
  alpha: number; // yaw (z-axis)
  beta: number;  // pitch (x-axis)
  gamma: number; // roll (y-axis)
  // Gyro resultant rotation magnitude: sqrt(alpha² + beta² + gamma²)
  rotationMagnitude: number;
}

export interface DetectionThresholds {
  // G-force spike threshold to trigger IMPACT_DETECTED (default: 3.5g)
  impactThresholdG: number;
  // Post-impact stillness confirmation duration in seconds (default: 3.0s)
  stillnessDurationSec: number;
  // Movement threshold (g variance) below which the device is considered stationary (default: 0.25g)
  stillnessVarianceG: number;
  // Minimum gyroscope angular velocity (deg/s) during impact to confirm vehicular tumbling (default: 180 deg/s)
  gyroTumbleThresholdDegPerSec: number;
  // Pre-alert countdown window in seconds (default: 15s)
  countdownDurationSec: number;
  // Optimization: Enable dynamic adaptive sensor sampling (30Hz cruise -> 60Hz impact burst)
  adaptiveSampling: boolean;
  // Optimization: Battery power saver mode
  powerSaverMode: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  etaMinutes?: number;
  phone: string;
  traumaLevel: string;
}

export interface IncidentRecord {
  id: string;
  timestamp: number;
  peakG: number;
  peakRotation: number;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
    address?: string;
  };
  classification: 'SEVERE_COLLISION' | 'ROLLOVER' | 'FALSE_ALARM_USER_CANCELLED' | 'FALSE_ALARM_STILLNESS_FAILED' | 'TEST_SIMULATION';
  dispatchedTo: string[];
  notes: string;
}

export type SimulationScenario = 
  | 'NONE'
  | 'HEAD_ON_COLLISION'
  | 'ROLLOVER_CRASH'
  | 'PHONE_DROP_REJECTION'
  | 'SPEED_BUMP_POTHOLE';

export type RoadHazardType = 
  | 'ACCIDENT_BLACKSPOT'
  | 'CONSTRUCTION'
  | 'SLIPPERY_ROAD'
  | 'SHARP_CURVE'
  | 'SPEED_CAMERA'
  | 'TRAFFIC_JAM';

export type RoadAlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface RoadAlert {
  id: string;
  type: RoadHazardType;
  severity: RoadAlertSeverity;
  title: string;
  description: string;
  roadName: string;
  speedLimitKmH: number;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  recommendedSpeedKmH?: number;
  iconName: string;
}

export interface DrivingTelemetry {
  currentSpeedKmH: number;
  roadSpeedLimitKmH: number;
  isOverspeeding: boolean;
  currentRoadName: string;
  headingDeg: number;
  units: 'km/h' | 'mph';
  currentLocation: { latitude: number; longitude: number };
  destinationName: string;
  routeEtaMinutes: number;
  routeDistanceKm: number;
}

export interface DispatchTransmissionStatus {
  step: number;
  title: string;
  detail: string;
  status: 'pending' | 'active' | 'completed';
  timestamp?: number;
}

export type MapEngine = 'auto' | 'google' | 'leaflet';

