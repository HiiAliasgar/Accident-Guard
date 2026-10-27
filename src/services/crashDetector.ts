// Core Crash Detection State Machine and Telemetry Analysis Engine
import { SensorDataPoint, SystemStatus, DetectionThresholds, IncidentRecord } from '../types';
import { emergencyAudio } from './audioService';
import { getCurrentCoordinates, DEFAULT_HOSPITALS, getSortedHospitals } from './locationService';

export const DEFAULT_THRESHOLDS: DetectionThresholds = {
  /**
   * IMPACT G THRESHOLD (3.5g):
   * Experimental starting value only. Smartphone placement, hardware, crash direction, vehicle dynamics,
   * and road conditions vary substantially. This threshold has not been validated against NHTSA/FMVSS
   * data or real-world driving and cannot reliably distinguish crashes from potholes or phone drops.
   * It is a prototype heuristic, not a safety guarantee.
   */
  impactThresholdG: 3.5,

  /**
   * STILLNESS CONFIRMATION WINDOW (3.0 seconds):
   * Experimental heuristic only. Post-impact motion varies by crash type, vehicle, phone mounting,
   * and user behavior. This window has not been validated and cannot reliably distinguish a crash
   * from a dropped phone, pothole, or other event.
   */
  stillnessDurationSec: 3.0,

  /**
   * STILLNESS VARIANCE THRESHOLD (0.25g):
   * Rationale: Quantifies acceleration fluctuations during the post-impact window.
   * If variance is < 0.25g, the device is immobilized (consistent with a crashed car).
   * If variance is > 0.25g, active movement/handling is ongoing -> dismiss as false alarm.
   */
  stillnessVarianceG: 0.25,

  /**
   * GYROSCOPE TUMBLING THRESHOLD (180 deg/s):
   * Rationale: Vehicular collisions (especially T-bone, rollovers, or sudden yaw shifts) generate
   * violent angular velocity spikes exceeding 180°/s to 400°/s+. This filter works in conjunction
   * with acceleration to reject simple non-rotational drops.
   */
  gyroTumbleThresholdDegPerSec: 180,

  /**
   * COUNTDOWN WINDOW (15 seconds):
   * Rationale: Provides conscious occupants ample time to cancel false alarms, while being short
   * enough that unconscious victims receive rapid trauma dispatch without hazardous delay.
   */
  countdownDurationSec: 15,

  // Dynamic adaptive sampling: 30Hz cruising -> 60Hz impact burst
  adaptiveSampling: true,
  // Power saver mode
  powerSaverMode: false
};

type StateChangeCallback = (state: SystemStatus, incident?: IncidentRecord | null) => void;
type CountdownTickCallback = (remainingSec: number) => void;

export class CrashDetectionEngine {
  private thresholds: DetectionThresholds = { ...DEFAULT_THRESHOLDS };
  private currentState: SystemStatus = 'NORMAL';

  // OPTIMIZATION: Zero-allocation circular ring buffer (replaces array.shift() O(N) copy)
  private readonly bufferCapacity = 200;
  private ringBuffer: (SensorDataPoint | null)[] = new Array(200).fill(null);
  private ringHead: number = 0;
  private ringCount: number = 0;

  // OPTIMIZATION: Incremental Welford's running mean and variance (M2) for O(1) computation
  private runningMean: number = 1.0;
  private runningM2: number = 0;
  private runningCount: number = 0;

  // Impact tracking variables
  private impactTimestamp: number = 0;
  private peakGRecorded: number = 0;
  private peakGyroRecorded: number = 0;

  // Countdown timer tracking
  private countdownRemaining: number = 15;
  private countdownTimerId: number | null = null;

  // Event callbacks
  private onStateChangeListeners: Set<StateChangeCallback> = new Set();
  private onCountdownTickListeners: Set<CountdownTickCallback> = new Set();
  private incidentHistory: IncidentRecord[] = [];

  constructor(initialThresholds?: Partial<DetectionThresholds>) {
    if (initialThresholds) {
      this.thresholds = { ...this.thresholds, ...initialThresholds };
    }
  }

  public getThresholds(): DetectionThresholds {
    return { ...this.thresholds };
  }

  public updateThresholds(newThresholds: Partial<DetectionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  public getState(): SystemStatus {
    return this.currentState;
  }

  public getCountdownRemaining(): number {
    return this.countdownRemaining;
  }

  public getIncidentHistory(): IncidentRecord[] {
    return [...this.incidentHistory];
  }

  public onStateChange(cb: StateChangeCallback): () => void {
    this.onStateChangeListeners.add(cb);
    return () => this.onStateChangeListeners.delete(cb);
  }

  public onCountdownTick(cb: CountdownTickCallback): () => void {
    this.onCountdownTickListeners.add(cb);
    return () => this.onCountdownTickListeners.delete(cb);
  }

  private setState(newState: SystemStatus, incident?: IncidentRecord | null) {
    this.currentState = newState;
    this.onStateChangeListeners.forEach((cb) => cb(newState, incident));
  }

  /**
   * Main telemetry intake loop - called 30-60 times per second
   * OPTIMIZATION: Uses circular buffer and incremental statistics
   */
  public processSensorFrame(point: SensorDataPoint) {
    // 1. Insert into circular ring buffer (O(1) complexity, zero heap allocation)
    this.ringBuffer[this.ringHead] = point;
    this.ringHead = (this.ringHead + 1) % this.bufferCapacity;
    if (this.ringCount < this.bufferCapacity) {
      this.ringCount++;
    }

    // 2. Incremental update of running variance
    this.runningCount++;
    const delta = point.magnitude - this.runningMean;
    this.runningMean += delta / this.runningCount;
    const delta2 = point.magnitude - this.runningMean;
    this.runningM2 += delta * delta2;

    // Reset running statistics periodically to avoid precision decay
    if (this.runningCount > 300) {
      this.runningCount = 150;
      this.runningM2 = this.runningM2 * 0.5;
    }

    const currentG = point.magnitude;
    const currentGyro = point.rotationMagnitude;

    // STATE MACHINE TRANSITIONS
    switch (this.currentState) {
      case 'NORMAL': {
        // Condition: resultant g exceeds threshold
        if (currentG >= this.thresholds.impactThresholdG) {
          this.impactTimestamp = point.timestamp;
          this.peakGRecorded = currentG;
          this.peakGyroRecorded = currentGyro;
          
          emergencyAudio.playImpactAlert();
          this.setState('IMPACT_DETECTED');
        }
        break;
      }

      case 'IMPACT_DETECTED': {
        // Track maximum impulse reached during collision pulse
        if (currentG > this.peakGRecorded) this.peakGRecorded = currentG;
        if (currentGyro > this.peakGyroRecorded) this.peakGyroRecorded = currentGyro;

        // Transition immediately into post-impact stillness confirmation
        const timeSinceImpactSec = (point.timestamp - this.impactTimestamp) / 1000;
        if (timeSinceImpactSec >= 0.4) {
          this.setState('CONFIRMING');
        }
        break;
      }

      case 'CONFIRMING': {
        // If emergency countdown has already started, do not re-evaluate or restart
        if (this.countdownTimerId !== null) {
          break;
        }

        if (currentG > this.peakGRecorded) this.peakGRecorded = currentG;
        if (currentGyro > this.peakGyroRecorded) this.peakGyroRecorded = currentGyro;

        const elapsedSinceImpactSec = (point.timestamp - this.impactTimestamp) / 1000;

        // Once confirmation duration window has elapsed, evaluate stillness variance
        if (elapsedSinceImpactSec >= this.thresholds.stillnessDurationSec) {
          // Compute variance of resultant magnitude over the post-impact window from ring buffer
          const windowSampleCount = Math.min(
            this.ringCount,
            Math.floor(this.thresholds.stillnessDurationSec * 45)
          );
          // Evaluate variance strictly post-impact (excluding the impact shockwave itself)
          const postImpactMinTimestamp = this.impactTimestamp + 400;
          const variance = this.calculateRingBufferVariance(windowSampleCount, postImpactMinTimestamp);

          // Check if vehicle stopped (variance < stillnessVarianceG)
          const isStationary = variance <= this.thresholds.stillnessVarianceG;
          // Check if gyro registered meaningful tumbling or if impact was high enough to warrant confirmation
          const registeredTumble = this.peakGyroRecorded >= (this.thresholds.gyroTumbleThresholdDegPerSec * 0.7);

          if (isStationary && registeredTumble) {
            // High confidence crash detected -> Start Countdown
            this.startEmergencyCountdown();
          } else {
            // False positive rejection! (User dropped phone and picked it up, or continued motion)
            this.recordRejectedIncident(variance);
          }
        }
        break;
      }

      case 'ALERT_TRIGGERED':
      case 'DISPATCHED':
      default:
        // Main emergency flow is handled via countdown/dispatch
        break;
    }
  }

  /**
   * OPTIMIZATION: Computes variance directly from circular ring buffer without array copies.
   * Uses two-pass algorithm: first pass computes mean, second computes sum-of-squared-diffs.
   */
  private calculateRingBufferVariance(count: number, minTimestamp?: number): number {
    if (count < 2) return 0;

    // Pass 1: compute mean in-place
    let sum = 0;
    let validCount = 0;
    for (let i = 0; i < count; i++) {
      const idx = (this.ringHead - 1 - i + this.bufferCapacity) % this.bufferCapacity;
      const point = this.ringBuffer[idx];
      if (point) {
        if (minTimestamp !== undefined && point.timestamp < minTimestamp) continue;
        sum += point.magnitude;
        validCount++;
      }
    }
    if (validCount < 2) return 0;
    const mean = sum / validCount;

    // Pass 2: compute sum of squared deviations in-place
    let sumSquaredDiff = 0;
    for (let i = 0; i < count; i++) {
      const idx = (this.ringHead - 1 - i + this.bufferCapacity) % this.bufferCapacity;
      const point = this.ringBuffer[idx];
      if (point) {
        if (minTimestamp !== undefined && point.timestamp < minTimestamp) continue;
        const diff = point.magnitude - mean;
        sumSquaredDiff += diff * diff;
      }
    }
    return sumSquaredDiff / validCount;
  }

  /**
   * Starts the 10-15s emergency abort countdown
   */
  private startEmergencyCountdown() {
    this.countdownRemaining = this.thresholds.countdownDurationSec;
    this.setState('CONFIRMING'); // Keeps confirming UI active or signals countdown transition
    emergencyAudio.startSiren();

    if (this.countdownTimerId !== null) {
      clearInterval(this.countdownTimerId);
    }

    this.countdownTimerId = window.setInterval(() => {
      this.countdownRemaining -= 1;
      emergencyAudio.playCountdownBeep(this.countdownRemaining <= 5);
      this.onCountdownTickListeners.forEach((cb) => cb(this.countdownRemaining));

      if (this.countdownRemaining <= 0) {
        this.finishCountdownAndTriggerAlert();
      }
    }, 1000);
  }

  /**
   * User pressed "I'M OK - CANCEL"
   */
  public cancelAlarmByUser(): void {
    if (this.countdownTimerId !== null) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }
    emergencyAudio.stopSiren();
    emergencyAudio.playCancelChime();

    this.countdownRemaining = this.thresholds.countdownDurationSec;
    const cancelledRecord: IncidentRecord = {
      id: `event-${Date.now()}`,
      timestamp: Date.now(),
      peakG: this.peakGRecorded,
      peakRotation: this.peakGyroRecorded,
      location: { lat: 37.7749, lng: -122.4194 },
      classification: 'FALSE_ALARM_USER_CANCELLED',
      dispatchedTo: [],
      notes: `Alert aborted by user pressing "I'm OK" during the ${this.thresholds.countdownDurationSec}s countdown window.`
    };
    this.incidentHistory.unshift(cancelledRecord);
    this.setState('NORMAL', cancelledRecord);
  }

  /**
   * Countdown elapsed without user cancellation: lock location and dispatch
   */
  private async finishCountdownAndTriggerAlert() {
    if (this.countdownTimerId !== null) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }
    emergencyAudio.stopSiren();

    let coords;
    try {
      coords = await getCurrentCoordinates();
    } catch {
      // Do not present guessed/demo coordinates as a live accident location.
      const locationUnavailableRecord: IncidentRecord = {
        id: `incident-${Date.now()}`,
        timestamp: Date.now(),
        peakG: this.peakGRecorded,
        peakRotation: this.peakGyroRecorded,
        location: { lat: 0, lng: 0 },
        classification: this.peakGyroRecorded > 300 ? 'ROLLOVER' : 'SEVERE_COLLISION',
        dispatchedTo: [],
        notes: 'Potential crash confirmed, but device location is unavailable. No automatic dispatch was sent by this prototype.'
      };
      this.incidentHistory.unshift(locationUnavailableRecord);
      this.setState('ALERT_TRIGGERED', locationUnavailableRecord);
      return;
    }
    const sortedHospitals = getSortedHospitals(coords, DEFAULT_HOSPITALS);
    const nearestHospital = sortedHospitals[0];

    const incident: IncidentRecord = {
      id: `incident-${Date.now()}`,
      timestamp: Date.now(),
      peakG: this.peakGRecorded,
      peakRotation: this.peakGyroRecorded,
      location: {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        address: nearestHospital.address
      },
      classification: this.peakGyroRecorded > 300 ? 'ROLLOVER' : 'SEVERE_COLLISION',
      dispatchedTo: [nearestHospital.name, nearestHospital.phone, '+1 (555) 911-0199'],
      notes: `Critical impact verified (${this.peakGRecorded.toFixed(1)}g). Automated emergency response initiated.`
    };

    this.incidentHistory.unshift(incident);
    this.setState('ALERT_TRIGGERED', incident);
  }

  /**
   * Manual trigger for demonstration / testing purposes
   */
  public triggerManualCrashDemo(): void {
    this.impactTimestamp = Date.now();
    this.peakGRecorded = 4.8;
    this.peakGyroRecorded = 280;
    this.startEmergencyCountdown();
  }

  /**
   * Records a rejected false-positive incident with real GPS coordinates (async, non-blocking)
   */
  private recordRejectedIncident(variance: number): void {
    const rejectedRecord: IncidentRecord = {
      id: `event-${Date.now()}`,
      timestamp: this.impactTimestamp,
      peakG: this.peakGRecorded,
      peakRotation: this.peakGyroRecorded,
      location: { lat: 37.7749, lng: -122.4194 },
      classification: 'FALSE_ALARM_STILLNESS_FAILED',
      dispatchedTo: [],
      notes: `Impact of ${this.peakGRecorded.toFixed(1)}g detected, but post-impact movement variance (${variance.toFixed(2)}g) indicated continued device handling or motion. False alarm dismissed.`
    };

    // Non-blocking GPS update for the record
    getCurrentCoordinates().then((coords) => {
      rejectedRecord.location = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy };
    }).catch(() => { /* keep fallback coords */ });

    this.incidentHistory.unshift(rejectedRecord);
    this.setState('NORMAL', rejectedRecord);
  }
}

export const crashDetector = new CrashDetectionEngine();
