// Navigation data contract for AccidentGuard.
//
// This service intentionally does not synthesize speed, road names, routes, ETAs,
// or hazards. Those values must come from a real platform/provider or remain
// explicitly unavailable. Simulation belongs in the separate test harness only.
import { DrivingTelemetry, RoadAlert, Hospital } from '../types';

export const DEFAULT_ROUTE_COORDINATES: [number, number][] = [];

type TelemetryListener = (
  telemetry: DrivingTelemetry,
  activeAlert: RoadAlert | null,
  alertsList: RoadAlert[]
) => void;

const unavailableTelemetry = (): DrivingTelemetry => ({
  currentSpeedKmH: 0,
  roadSpeedLimitKmH: 0,
  isOverspeeding: false,
  currentRoadName: 'Unavailable — no navigation provider',
  headingDeg: 0,
  units: 'km/h',
  currentLocation: { latitude: 0, longitude: 0 },
  destinationName: 'No destination selected',
  routeEtaMinutes: 0,
  routeDistanceKm: 0
});

class NavigationService {
  private listeners = new Set<TelemetryListener>();
  private telemetry = unavailableTelemetry();
  private roadAlerts: RoadAlert[] = [];
  private destinationHospital: Hospital | null = null;

  public getTelemetry(): DrivingTelemetry {
    return {
      ...this.telemetry,
      currentLocation: { ...this.telemetry.currentLocation },
      destinationName: this.destinationHospital?.name ?? 'No destination selected'
    };
  }

  public getRoadAlerts(): RoadAlert[] {
    return [];
  }

  public getActiveAlert(): RoadAlert | null {
    return null;
  }

  public subscribe(cb: TelemetryListener): () => void {
    this.listeners.add(cb);
    cb(this.getTelemetry(), null, []);
    return () => this.listeners.delete(cb);
  }

  // These methods remain no-ops until a genuine vehicle telemetry source is
  // integrated. Phone GPS does not provide a vehicle speed limit or road name.
  public accelerate(_delta?: number): void {}
  public brake(_delta?: number): void {}
  public cruise(): void {}
  public emergencyStop(): void {}
  public setSpeed(_speed?: number): void {}

  public toggleUnits(): void {
    this.telemetry = {
      ...this.telemetry,
      units: this.telemetry.units === 'km/h' ? 'mph' : 'km/h'
    };
    this.notify();
  }

  public setDestinationHospital(hospital: Hospital): void {
    this.destinationHospital = hospital;
    this.notify();
  }

  private notify(): void {
    const telemetry = this.getTelemetry();
    this.listeners.forEach((listener) => listener(telemetry, null, []));
  }
}

export const navigationService = new NavigationService();
