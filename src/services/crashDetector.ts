// Core Crash Detection State Machine and Telemetry Analysis Engine
import { SensorDataPoint, SystemStatus, DetectionThresholds, IncidentRecord } from '../types';
import { emergencyAudio } from './audioService';
import { getCurrentCoordinates } from './locationService';

export const DEFAULT_THRESHOLDS: DetectionThresholds = {
  impactThresholdG: 3.5,
  stillnessDurationSec: 3.0,
  stillnessVarianceG: 0.25,
  gyroTumbleThresholdDegPerSec: 180.0,
  countdownDurationSec: 15,
  adaptiveSampling: true,
  powerSaverMode: false,
};

const MIN_POST_IMPACT_SAMPLES = 5;
const ROLLOVER_GYRO_THRESHOLD_DEG_PER_SEC = 300;

export class CrashDetector {
  private thresholds: DetectionThresholds;
  private currentState: SystemStatus = 'NORMAL';
  private ringBuffer: (SensorDataPoint | undefined)[] = [];
  private ringHead = 0;
  private ringCount = 0;
  private readonly bufferCapacity = 300; // ~5-10s at 30-60Hz

  private impactTimestamp = 0;
  private peakGRecorded = 0;
  private peakGyroRecorded = 0;
  private countdownRemaining = 15;
  private countdownTimerId: ReturnType<typeof setInterval> | null = null;
  private alertSessionId = 0;
  private lastFrameTimestamp = 0;
  private incidentHistory: IncidentRecord[] = [];

  private onStateChangeListeners: Set<(status: SystemStatus, incident?: IncidentRecord | null) => void> = new Set();
  private onCountdownTickListeners: Set<(secondsLeft: number) => void> = new Set();

  constructor(thresholds: Partial<DetectionThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.countdownRemaining = this.thresholds.countdownDurationSec;
    this.ringBuffer = new Array(this.bufferCapacity);
  }

  public getThresholds(): DetectionThresholds {
    return { ...this.thresholds };
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

  public updateThresholds(newThresholds: Partial<DetectionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  public onStateChange(cb: (status: SystemStatus, incident?: IncidentRecord | null) => void): () => void {
    this.onStateChangeListeners.add(cb);
    return () => this.onStateChangeListeners.delete(cb);
  }

  public onCountdownTick(cb: (secondsLeft: number) => void): () => void {
    this.onCountdownTickListeners.add(cb);
    return () => this.onCountdownTickListeners.delete(cb);
  }

  private setState(newState: SystemStatus, incident?: IncidentRecord | null): void {
    this.currentState = newState;
    this.onStateChangeListeners.forEach((cb) => cb(newState, incident));
  }

  private clearCountdownTimer(): void {
    if (this.countdownTimerId !== null) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }
  }

  public reset(): void {
    this.clearCountdownTimer();
    this.alertSessionId += 1;
    emergencyAudio.stopSiren();
    this.impactTimestamp = 0;
    this.peakGRecorded = 0;
    this.peakGyroRecorded = 0;
    this.countdownRemaining = this.thresholds.countdownDurationSec;
    this.setState('NORMAL', null);
  }

  /**
   * Main telemetry intake loop - called 30-60 times per second
   */
  public processSensorFrame(point: SensorDataPoint): void {
    if (this.lastFrameTimestamp > 0 && point.timestamp < this.lastFrameTimestamp) {
      this.handleSensorInterruption();
    }
    this.lastFrameTimestamp = point.timestamp;

    // 1. Store shallow copy in ring buffer to prevent reference aliasing
    this.ringBuffer[this.ringHead] = { ...point };
    this.ringHead = (this.ringHead + 1) % this.bufferCapacity;
    if (this.ringCount < this.bufferCapacity) {
      this.ringCount++;
    }

    const currentG = point.magnitude;
    const currentGyro = point.rotationMagnitude;

    switch (this.currentState) {
      case 'NORMAL': {
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
        if (currentG > this.peakGRecorded) this.peakGRecorded = currentG;
        if (currentGyro > this.peakGyroRecorded) this.peakGyroRecorded = currentGyro;

        const timeSinceImpactSec = (point.timestamp - this.impactTimestamp) / 1000;
        if (
          timeSinceImpactSec >= 0.4 ||
          currentGyro >= this.thresholds.gyroTumbleThresholdDegPerSec ||
          this.peakGyroRecorded >= this.thresholds.gyroTumbleThresholdDegPerSec
        ) {
          this.setState('CONFIRMING');
        }
        break;
      }

      case 'CONFIRMING': {
        const elapsedSinceImpactSec = (point.timestamp - this.impactTimestamp) / 1000;

        // Continue capturing peak impulse during initial 1.0s of collision pulse
        if (elapsedSinceImpactSec <= 1.0) {
          if (currentG > this.peakGRecorded) this.peakGRecorded = currentG;
          if (currentGyro > this.peakGyroRecorded) this.peakGyroRecorded = currentGyro;
        }

        if (elapsedSinceImpactSec >= this.thresholds.stillnessDurationSec) {
          const postImpactMinTimestamp = this.impactTimestamp + 400;
          const stdDevG = this.calculateRingBufferStdDev(this.ringCount, postImpactMinTimestamp);

          const isStationary = Number.isFinite(stdDevG) && stdDevG <= this.thresholds.stillnessVarianceG;
          const registeredTumble = this.peakGyroRecorded >= this.thresholds.gyroTumbleThresholdDegPerSec;

          if (isStationary && registeredTumble) {
            this.startEmergencyCountdown();
          } else {
            this.recordRejectedIncident(stdDevG);
          }
        }
        break;
      }

      case 'COUNTDOWN':
      case 'ALERT_TRIGGERED':
      case 'DISPATCHED':
      case 'CANCELLED':
        break;
    }
  }

  private handleSensorInterruption(): void {
    this.ringHead = 0;
    this.ringCount = 0;
  }

  private calculateRingBufferStdDev(count: number, minTimestamp: number): number {
    if (count === 0) return Infinity;
    let sum = 0;
    let validSamples = 0;

    for (let i = 0; i < count; i++) {
      const idx = (this.ringHead - 1 - i + this.bufferCapacity) % this.bufferCapacity;
      const sample = this.ringBuffer[idx];
      if (sample && sample.timestamp >= minTimestamp) {
        sum += sample.magnitude;
        validSamples++;
      }
    }

    // Never treat missing/insufficient samples as valid stillness confirmation
    if (validSamples < MIN_POST_IMPACT_SAMPLES) return Infinity;

    const mean = sum / validSamples;
    let varianceSum = 0;

    for (let i = 0; i < count; i++) {
      const idx = (this.ringHead - 1 - i + this.bufferCapacity) % this.bufferCapacity;
      const sample = this.ringBuffer[idx];
      if (sample && sample.timestamp >= minTimestamp) {
        varianceSum += Math.pow(sample.magnitude - mean, 2);
      }
    }

    return Math.sqrt(varianceSum / validSamples);
  }

  private startEmergencyCountdown(): void {
    if (this.currentState === 'COUNTDOWN') return;

    this.clearCountdownTimer();
    this.alertSessionId += 1;
    const session = this.alertSessionId;

    this.countdownRemaining = this.thresholds.countdownDurationSec;
    this.setState('COUNTDOWN');
    this.onCountdownTickListeners.forEach((cb) => cb(this.countdownRemaining));

    emergencyAudio.startSiren();

    this.countdownTimerId = setInterval(async () => {
      if (this.alertSessionId !== session) {
        this.clearCountdownTimer();
        return;
      }

      this.countdownRemaining -= 1;
      this.onCountdownTickListeners.forEach((cb) => cb(this.countdownRemaining));

      if (this.countdownRemaining <= 0) {
        this.clearCountdownTimer();
        await this.triggerEmergencyAlert(session);
      }
    }, 1000);
  }

  public triggerManualCrashDemo(): void {
    if (this.currentState === 'NORMAL') {
      this.impactTimestamp = Date.now();
      this.peakGRecorded = 4.8;
      this.peakGyroRecorded = 240;
      this.startEmergencyCountdown();
    }
  }

  public async triggerImmediateDispatch(): Promise<void> {
    if (this.currentState !== 'COUNTDOWN') return;
    this.clearCountdownTimer();
    this.alertSessionId += 1;
    const session = this.alertSessionId;
    await this.triggerEmergencyAlert(session, 'DISPATCHED');
  }

  public cancelAlarmByUser(): void {
    this.clearCountdownTimer();
    this.alertSessionId += 1;
    emergencyAudio.stopSiren();
    emergencyAudio.playCancelChime();

    const record: IncidentRecord = {
      id: `INC-CANCEL-${Date.now()}`,
      timestamp: this.impactTimestamp || Date.now(),
      peakG: this.peakGRecorded,
      peakRotation: this.peakGyroRecorded,
      location: null,
      locationStatus: 'UNAVAILABLE',
      classification: 'FALSE_ALARM_USER_CANCELLED',
      dispatchedTo: [],
      notes: 'User cancelled the alert manually.'
    };

    this.incidentHistory.unshift(record);
    this.setState('NORMAL', record);
  }

  private async triggerEmergencyAlert(
    session: number,
    targetState: 'ALERT_TRIGGERED' | 'DISPATCHED' = 'ALERT_TRIGGERED'
  ): Promise<void> {
    emergencyAudio.stopSiren();
    let coords: IncidentRecord['location'] = null;
    let locationStatus: 'VERIFIED' | 'UNAVAILABLE' = 'UNAVAILABLE';

    try {
      const pos = await getCurrentCoordinates();
      coords = {
        lat: pos.latitude,
        lng: pos.longitude,
        accuracy: pos.accuracy
      };
      locationStatus = 'VERIFIED';
    } catch (e) {
      console.warn('Emergency location retrieval failed:', e);
    }

    // Prevent stale async GPS callback from mutating state after reset/cancel
    if (this.alertSessionId !== session) return;

    const classification =
      this.peakGyroRecorded > ROLLOVER_GYRO_THRESHOLD_DEG_PER_SEC
        ? 'ROLLOVER'
        : 'SEVERE_COLLISION';

    const record: IncidentRecord = {
      id: `INC-${Date.now()}`,
      timestamp: this.impactTimestamp || Date.now(),
      peakG: this.peakGRecorded,
      peakRotation: this.peakGyroRecorded,
      location: coords,
      locationStatus,
      classification,
      dispatchedTo: [],
      notes: `Automated detection: Peak G=${this.peakGRecorded.toFixed(1)}, Peak Rotation=${this.peakGyroRecorded.toFixed(1)} deg/s`
    };

    this.incidentHistory.unshift(record);
    this.setState(targetState, record);
  }

  private recordRejectedIncident(stdDevG: number): void {
    const reason = Number.isFinite(stdDevG)
      ? `Rejected due to post-impact motion: stdDev=${stdDevG.toFixed(3)}g`
      : 'Rejected due to insufficient post-impact sensor samples';

    const record: IncidentRecord = {
      id: `INC-REJ-${Date.now()}`,
      timestamp: this.impactTimestamp || Date.now(),
      peakG: this.peakGRecorded,
      peakRotation: this.peakGyroRecorded,
      location: null,
      locationStatus: 'UNAVAILABLE',
      classification: 'FALSE_ALARM_STILLNESS_FAILED',
      dispatchedTo: [],
      notes: reason,
    };

    this.incidentHistory.unshift(record);
    this.setState('NORMAL', record);
  }
}

export const crashDetector = new CrashDetector();
export { CrashDetector as CrashDetectionEngine };
