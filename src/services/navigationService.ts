// Navigation and Road Intelligence Service: Real-Time Speed Tracking, Road Speed Limits, Hazards & Route Simulation
import { RoadAlert, DrivingTelemetry, Hospital } from '../types';
import { calculateHaversineDistance, DEFAULT_HOSPITALS } from './locationService';

// Pre-configured route waypoints simulating navigation from SF Civic Center towards Metropolitan Level-1 Trauma Center
export const DEFAULT_ROUTE_COORDINATES: [number, number][] = [
  [37.7793, -122.4192], // SF City Hall / Civic Plaza
  [37.7772, -122.4170], // Market St & 9th St
  [37.7753, -122.4150], // Market St & 8th St (Accident Blackspot zone)
  [37.7725, -122.4120], // Market St & 6th St
  [37.7700, -122.4095], // 5th St / Mission Connector
  [37.7665, -122.4070], // 10th St & Brannan St (Construction)
  [37.7620, -122.4055], // Division St / Potrero Ave
  [37.7585, -122.4050], // Potrero Ave Corridor
  [37.7558, -122.4045]  // Metropolitan Level-1 Trauma Center Destination
];

export const ROAD_SEGMENTS = [
  { name: 'Civic Center Boulevard', speedLimit: 40, startIdx: 0, endIdx: 1 },
  { name: 'Market St (High-Density Corridor)', speedLimit: 45, startIdx: 1, endIdx: 3 },
  { name: 'Mission Expressway Link', speedLimit: 60, startIdx: 3, endIdx: 5 },
  { name: 'Division / Highway 101 Overpass', speedLimit: 50, startIdx: 5, endIdx: 7 },
  { name: 'Potrero Ave Hospital Approach', speedLimit: 35, startIdx: 7, endIdx: 8 }
];

export const INITIAL_ROAD_ALERTS: RoadAlert[] = [
  {
    id: 'alert-blackspot-1',
    type: 'ACCIDENT_BLACKSPOT',
    severity: 'CRITICAL',
    title: 'High Collision Accident Blackspot',
    description: 'Frequent multi-vehicle intersection collisions recorded in past 90 days. Maintain safe following distance.',
    roadName: 'Market St & 8th St Intersection',
    speedLimitKmH: 40,
    recommendedSpeedKmH: 30,
    distanceMeters: 280,
    latitude: 37.7753,
    longitude: -122.4150,
    iconName: 'AlertTriangle'
  },
  {
    id: 'alert-construction-2',
    type: 'CONSTRUCTION',
    severity: 'WARNING',
    title: 'Active Road Work / Narrow Right Lane',
    description: 'Utility trenching & heavy machinery on right lane. Expect sudden lane merges and braking.',
    roadName: '10th & Brannan Bypass',
    speedLimitKmH: 40,
    recommendedSpeedKmH: 35,
    distanceMeters: 750,
    latitude: 37.7665,
    longitude: -122.4070,
    iconName: 'Cone'
  },
  {
    id: 'alert-curve-3',
    type: 'SHARP_CURVE',
    severity: 'WARNING',
    title: 'Sharp Overpass Curve Ahead',
    description: 'High lateral G force curve. Advisory speed 35 km/h to prevent rollover on bridge deck.',
    roadName: 'US-101 South Ramp Connection',
    speedLimitKmH: 50,
    recommendedSpeedKmH: 35,
    distanceMeters: 1200,
    latitude: 37.7620,
    longitude: -122.4055,
    iconName: 'CornerUpRight'
  },
  {
    id: 'alert-camera-4',
    type: 'SPEED_CAMERA',
    severity: 'INFO',
    title: 'Automated Radar Speed Enforcement',
    description: 'Fixed speed radar camera active. Speed limit strictly monitored at 45 km/h.',
    roadName: 'Mission St Mid-Block',
    speedLimitKmH: 45,
    recommendedSpeedKmH: 45,
    distanceMeters: 1800,
    latitude: 37.7700,
    longitude: -122.4095,
    iconName: 'Camera'
  },
  {
    id: 'alert-slippery-5',
    type: 'SLIPPERY_ROAD',
    severity: 'WARNING',
    title: 'Slippery Wet Asphalt Detected',
    description: 'Reduced friction coefficient from surface rain runoff. Increased braking distance required.',
    roadName: 'Potrero Ave Hospital Approach',
    speedLimitKmH: 35,
    recommendedSpeedKmH: 25,
    distanceMeters: 2400,
    latitude: 37.7585,
    longitude: -122.4050,
    iconName: 'CloudRain'
  }
];

type TelemetryListener = (telemetry: DrivingTelemetry, activeAlert: RoadAlert | null, alertsList: RoadAlert[]) => void;

class NavigationService {
  private listeners: Set<TelemetryListener> = new Set();
  private simulationTimerId: number | null = null;

  // Driving Telemetry State
  private currentSpeedKmH: number = 54;
  private targetSpeedKmH: number = 54;
  private roadSpeedLimitKmH: number = 50;
  private currentRoadName: string = 'Market St (High-Density Corridor)';
  private headingDeg: number = 145;
  private units: 'km/h' | 'mph' = 'km/h';

  // Position along route
  private routeIndex: number = 1;
  private routeProgress: number = 0.3; // 0 to 1 between routeIndex and routeIndex+1
  private currentCoords: { latitude: number; longitude: number } = {
    latitude: DEFAULT_ROUTE_COORDINATES[1][0],
    longitude: DEFAULT_ROUTE_COORDINATES[1][1]
  };

  private roadAlerts: RoadAlert[] = [...INITIAL_ROAD_ALERTS];
  private destinationHospital: Hospital = DEFAULT_HOSPITALS[0];

  constructor() {
    this.startSimulationLoop();
  }

  public getTelemetry(): DrivingTelemetry {
    return {
      currentSpeedKmH: Math.round(this.currentSpeedKmH),
      roadSpeedLimitKmH: this.roadSpeedLimitKmH,
      isOverspeeding: this.currentSpeedKmH > (this.roadSpeedLimitKmH + 3),
      currentRoadName: this.currentRoadName,
      headingDeg: Math.round(this.headingDeg),
      units: this.units,
      currentLocation: { ...this.currentCoords },
      destinationName: this.destinationHospital.name,
      routeEtaMinutes: Math.max(2, Math.round(((DEFAULT_ROUTE_COORDINATES.length - this.routeIndex) * 0.8))),
      routeDistanceKm: parseFloat(((DEFAULT_ROUTE_COORDINATES.length - this.routeIndex) * 0.45).toFixed(1))
    };
  }

  public getRoadAlerts(): RoadAlert[] {
    return this.roadAlerts;
  }

  public getActiveAlert(): RoadAlert | null {
    // Find alert within 500 meters of current position
    const upcoming = this.roadAlerts
      .filter((alert) => alert.distanceMeters > 0 && alert.distanceMeters <= 500)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    return upcoming.length > 0 ? upcoming[0] : null;
  }

  public subscribe(cb: TelemetryListener): () => void {
    this.listeners.add(cb);
    cb(this.getTelemetry(), this.getActiveAlert(), this.roadAlerts);
    return () => this.listeners.delete(cb);
  }

  public accelerate(delta: number = 10) {
    this.targetSpeedKmH = Math.min(130, this.targetSpeedKmH + delta);
  }

  public brake(delta: number = 15) {
    this.targetSpeedKmH = Math.max(0, this.targetSpeedKmH - delta);
  }

  public cruise() {
    this.targetSpeedKmH = this.roadSpeedLimitKmH;
  }

  public emergencyStop() {
    this.targetSpeedKmH = 0;
    this.currentSpeedKmH = 0;
    this.notify();
  }

  public setSpeed(speed: number) {
    this.targetSpeedKmH = Math.max(0, Math.min(140, speed));
  }

  public toggleUnits() {
    this.units = this.units === 'km/h' ? 'mph' : 'km/h';
    this.notify();
  }

  public setDestinationHospital(hospital: Hospital) {
    this.destinationHospital = hospital;
    this.notify();
  }

  private startSimulationLoop() {
    if (this.simulationTimerId !== null) return;

    this.simulationTimerId = window.setInterval(() => {
      // 1. Smoothly interpolate speed towards target
      if (Math.abs(this.currentSpeedKmH - this.targetSpeedKmH) > 0.5) {
        const step = (this.targetSpeedKmH - this.currentSpeedKmH) * 0.15;
        this.currentSpeedKmH += step;
      } else {
        // Subtle real-world cruise speed fluctuation
        if (this.targetSpeedKmH > 0) {
          this.currentSpeedKmH = this.targetSpeedKmH + (Math.sin(Date.now() / 1500) * 0.8);
        } else {
          this.currentSpeedKmH = 0;
        }
      }

      // 2. Advance vehicle along route if vehicle is moving
      if (this.currentSpeedKmH > 2) {
        // Speed in km/h -> km/sec -> progress step
        const speedKmPerSec = this.currentSpeedKmH / 3600;
        const segmentLengthKm = 0.45; // ~450m per segment
        const progressIncrement = (speedKmPerSec / segmentLengthKm) * 0.4; // simulated pacing

        this.routeProgress += progressIncrement;

        if (this.routeProgress >= 1.0) {
          this.routeProgress = 0;
          this.routeIndex = (this.routeIndex + 1) % (DEFAULT_ROUTE_COORDINATES.length - 1);
        }

        // Interpolate coordinates between current segment waypoints
        const p1 = DEFAULT_ROUTE_COORDINATES[this.routeIndex];
        const p2 = DEFAULT_ROUTE_COORDINATES[this.routeIndex + 1];
        if (p1 && p2) {
          this.currentCoords = {
            latitude: p1[0] + (p2[0] - p1[0]) * this.routeProgress,
            longitude: p1[1] + (p2[1] - p1[1]) * this.routeProgress
          };

          // Calculate compass heading between p1 and p2
          const dLat = p2[0] - p1[0];
          const dLon = p2[1] - p1[1];
          const angleRad = Math.atan2(dLon, dLat);
          this.headingDeg = (angleRad * 180 / Math.PI + 360) % 360;
        }

        // Update current road segment & speed limit
        const activeSegment = ROAD_SEGMENTS.find(
          (seg) => this.routeIndex >= seg.startIdx && this.routeIndex <= seg.endIdx
        ) || ROAD_SEGMENTS[0];

        this.currentRoadName = activeSegment.name;
        this.roadSpeedLimitKmH = activeSegment.speedLimit;

        // OPTIMIZATION: Mutate distances in-place (array is owned, avoids 25 obj allocs/sec)
        for (let i = 0; i < this.roadAlerts.length; i++) {
          const alert = this.roadAlerts[i];
          const distKm = calculateHaversineDistance(
            this.currentCoords.latitude,
            this.currentCoords.longitude,
            alert.latitude,
            alert.longitude
          );
          alert.distanceMeters = Math.max(0, Math.round(distKm * 1000));
        }
      }

      this.notify();
    }, 200); // 5Hz UI update loop
  }

  private notify() {
    const telemetry = this.getTelemetry();
    const activeAlert = this.getActiveAlert();
    this.listeners.forEach((cb) => cb(telemetry, activeAlert, this.roadAlerts));
  }
}

export const navigationService = new NavigationService();
