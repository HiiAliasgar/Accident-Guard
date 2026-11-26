// High-frequency (~50Hz) Sensor Telemetry Manager with Real Hardware & Physics Simulation support
import { SensorDataPoint, SimulationScenario } from '../types';

/** Pure arithmetic rounding — avoids parseFloat(toFixed()) string allocation in hot loops */
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round1 = (v: number): number => Math.round(v * 10) / 10;

type SensorCallback = (point: SensorDataPoint) => void;
type SourceChangeCallback = (isSimulated: boolean) => void;

class SensorService {
  private callbacks: Set<SensorCallback> = new Set();
  private sourceListeners: Set<SourceChangeCallback> = new Set();
  private timerId: ReturnType<typeof setInterval> | null = null;
  private isSimulated: boolean = true;
  private isHardwareAvailable: boolean = false;
  private hasPermission: boolean = false;
  private isListenerAttached: boolean = false;
  private burstTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Real sensor state cache (normalized to g, 1g = 9.80665 m/s²)
  private currentRawAccel = { x: 0, y: 0, z: 1.0 };
  private currentRawGyro = { alpha: 0, beta: 0, gamma: 0 };

  // Simulation physics state
  private currentScenario: SimulationScenario = 'NONE';
  private scenarioStartTime: number = 0;
  private simTimeSec: number = 0;

  // Adaptive sampling & battery optimization
  private currentHz: number = 50;
  private isAdaptiveSampling: boolean = true;
  private isPowerSaver: boolean = false;

  private handleDeviceMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (acc && (acc.x !== null || acc.y !== null || acc.z !== null)) {
      this.currentRawAccel = {
        x: (acc.x ?? 0) / 9.80665,
        y: (acc.y ?? 0) / 9.80665,
        z: (acc.z ?? 0) / 9.80665
      };
    } else if (event.acceleration && (event.acceleration.x !== null || event.acceleration.y !== null || event.acceleration.z !== null)) {
      this.currentRawAccel = {
        x: (event.acceleration.x ?? 0) / 9.80665,
        y: (event.acceleration.y ?? 0) / 9.80665,
        z: 1.0 + (event.acceleration.z ?? 0) / 9.80665
      };
    }
    const rot = event.rotationRate;
    if (rot) {
      this.currentRawGyro = {
        alpha: rot.alpha ?? 0,
        beta: rot.beta ?? 0,
        gamma: rot.gamma ?? 0
      };
    }
  };

  constructor() {
    this.checkHardwareSupport();
  }

  private checkHardwareSupport(): void {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      this.isHardwareAvailable = true;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      this.isSimulated = !isMobile;

      // On Android / non-iOS mobile where explicit permission API isn't required, mark ready
      const dme = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (isMobile && typeof dme.requestPermission !== 'function') {
        this.hasPermission = true;
      }
    } else {
      this.isSimulated = true;
    }
  }

  private notifySourceChange(): void {
    this.sourceListeners.forEach((cb) => cb(this.isSimulated));
  }

  public onSourceChange(cb: SourceChangeCallback): () => void {
    this.sourceListeners.add(cb);
    return () => this.sourceListeners.delete(cb);
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }

  public getIsHardwareAvailable(): boolean {
    return this.isHardwareAvailable;
  }

  public async setIsSimulated(sim: boolean): Promise<boolean> {
    if (sim) {
      this.isSimulated = true;
      this.detachHardwareListeners();
      this.notifySourceChange();
      return true;
    }

    const granted = await this.requestHardwarePermissions();
    if (granted) {
      this.isSimulated = false;
      this.currentScenario = 'NONE';
      this.notifySourceChange();
      return true;
    }
    return false;
  }

  public async requestHardwarePermissions(): Promise<boolean> {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return false;

    const DeviceMotionEventWithPermission = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceMotionEventWithPermission.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEventWithPermission.requestPermission();
        if (response === 'granted') {
          this.hasPermission = true;
          this.attachHardwareListeners();
          return true;
        }
      } catch (err) {
        console.warn('Sensor permission error:', err);
      }
      return false;
    } else {
      this.hasPermission = true;
      this.attachHardwareListeners();
      return true;
    }
  }

  private attachHardwareListeners(): void {
    if (typeof window === 'undefined' || this.isListenerAttached) return;
    window.addEventListener('devicemotion', this.handleDeviceMotion);
    this.isListenerAttached = true;
  }

  private detachHardwareListeners(): void {
    if (typeof window === 'undefined' || !this.isListenerAttached) return;
    window.removeEventListener('devicemotion', this.handleDeviceMotion);
    this.isListenerAttached = false;
  }

  public subscribe(cb: SensorCallback): () => void {
    this.callbacks.add(cb);
    if (this.callbacks.size === 1) {
      this.startSampling();
    }
    return () => {
      this.callbacks.delete(cb);
      if (this.callbacks.size === 0) {
        this.stopSampling();
      }
    };
  }

  public setAdaptiveSampling(enabled: boolean): void {
    this.isAdaptiveSampling = enabled;
    this.adjustSamplingRate(this.isPowerSaver ? 30 : 50);
  }

  public setPowerSaverMode(enabled: boolean): void {
    this.isPowerSaver = enabled;
    this.adjustSamplingRate(enabled ? 30 : 50);
  }

  public getSamplingRate(): number {
    return this.currentHz;
  }

  private adjustSamplingRate(targetHz: number): void {
    if (this.currentHz === targetHz) return;
    this.currentHz = targetHz;
    if (this.timerId !== null) {
      this.stopSampling();
      this.startSampling();
    }
  }

  public triggerScenario(scenario: SimulationScenario): void {
    this.currentScenario = scenario;
    this.scenarioStartTime = Date.now();
    if (!this.isSimulated) {
      this.isSimulated = true;
      this.notifySourceChange();
    }

    if (this.burstTimeoutId !== null) {
      clearTimeout(this.burstTimeoutId);
      this.burstTimeoutId = null;
    }
    if (this.isAdaptiveSampling) {
      this.adjustSamplingRate(60);
      this.burstTimeoutId = setTimeout(() => {
        this.currentScenario = 'NONE';
        this.adjustSamplingRate(this.isPowerSaver ? 30 : 50);
        this.burstTimeoutId = null;
      }, 5000);
    }
  }

  public getCurrentScenario(): SimulationScenario {
    return this.currentScenario;
  }

  private startSampling(): void {
    if (this.timerId !== null) return;
    if (!this.isSimulated && this.hasPermission) {
      this.attachHardwareListeners();
    }
    const intervalMs = Math.round(1000 / this.currentHz);

    this.timerId = setInterval(() => {
      const now = Date.now();
      const point = this.generateSample(now);
      this.callbacks.forEach((cb) => cb({ ...point }));
    }, intervalMs);
  }

  private stopSampling(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.burstTimeoutId !== null) {
      clearTimeout(this.burstTimeoutId);
      this.burstTimeoutId = null;
    }
    this.detachHardwareListeners();
  }

  private generateSample(now: number): SensorDataPoint {
    let x = 0;
    let y = 0;
    let z = 1.0;
    let alpha = 0;
    let beta = 0;
    let gamma = 0;

    if (!this.isSimulated && this.hasPermission) {
      x = this.currentRawAccel.x;
      y = this.currentRawAccel.y;
      z = this.currentRawAccel.z;
      alpha = this.currentRawGyro.alpha;
      beta = this.currentRawGyro.beta;
      gamma = this.currentRawGyro.gamma;
    } else {
      this.simTimeSec += 1 / this.currentHz;
      const elapsedScenarioSec = (now - this.scenarioStartTime) / 1000;

      const roadVibeX = (Math.sin(this.simTimeSec * 14) * 0.06) + (Math.random() - 0.5) * 0.04;
      const roadVibeY = (Math.cos(this.simTimeSec * 11) * 0.05) + (Math.random() - 0.5) * 0.04;
      const roadVibeZ = 1.0 + (Math.sin(this.simTimeSec * 18) * 0.08) + (Math.random() - 0.5) * 0.05;

      const baseGyroYaw = Math.sin(this.simTimeSec * 2) * 5 + (Math.random() - 0.5) * 4;
      const baseGyroPitch = Math.cos(this.simTimeSec * 1.5) * 4 + (Math.random() - 0.5) * 3;
      const baseGyroRoll = Math.sin(this.simTimeSec * 3) * 3 + (Math.random() - 0.5) * 3;

      if (this.currentScenario === 'HEAD_ON_COLLISION') {
        if (elapsedScenarioSec < 0.4) {
          x = roadVibeX;
          y = roadVibeY + 0.15;
          z = roadVibeZ;
          alpha = baseGyroYaw;
          beta = baseGyroPitch;
          gamma = baseGyroRoll;
        } else if (elapsedScenarioSec >= 0.4 && elapsedScenarioSec < 0.75) {
          const peakProgress = (elapsedScenarioSec - 0.4) / 0.35;
          const impactProfile = Math.sin(peakProgress * Math.PI);
          x = roadVibeX + impactProfile * 1.4;
          y = -4.6 * impactProfile + (Math.random() - 0.5) * 0.4;
          z = 1.0 + impactProfile * 2.1;
          alpha = impactProfile * 140 + (Math.random() - 0.5) * 15;
          beta = -impactProfile * 180 + (Math.random() - 0.5) * 15;
          gamma = impactProfile * 100;
        } else {
          x = (Math.random() - 0.5) * 0.02;
          y = (Math.random() - 0.5) * 0.02;
          z = 0.98 + (Math.random() - 0.5) * 0.02;
          alpha = (Math.random() - 0.5) * 1.5;
          beta = (Math.random() - 0.5) * 1.5;
          gamma = (Math.random() - 0.5) * 1.5;
        }
      } else if (this.currentScenario === 'ROLLOVER_CRASH') {
        if (elapsedScenarioSec < 0.3) {
          x = roadVibeX;
          y = roadVibeY;
          z = roadVibeZ;
        } else if (elapsedScenarioSec >= 0.3 && elapsedScenarioSec < 1.4) {
          const t = elapsedScenarioSec - 0.3;
          x = Math.sin(t * 12) * 3.6 + (Math.random() - 0.5) * 0.5;
          y = Math.cos(t * 10) * 3.2;
          z = 1.0 + Math.sin(t * 8) * 2.8;
          alpha = 340 * Math.cos(t * 8);
          beta = 280 * Math.sin(t * 7);
          gamma = 420 * Math.sin(t * 9);
        } else {
          x = 0.88 + (Math.random() - 0.5) * 0.02;
          y = 0.42 + (Math.random() - 0.5) * 0.02;
          z = 0.15 + (Math.random() - 0.5) * 0.02;
          alpha = (Math.random() - 0.5) * 1;
          beta = (Math.random() - 0.5) * 1;
          gamma = (Math.random() - 0.5) * 1;
        }
      } else if (this.currentScenario === 'PHONE_DROP_REJECTION') {
        if (elapsedScenarioSec < 0.3) {
          x = roadVibeX;
          y = roadVibeY;
          z = roadVibeZ;
        } else if (elapsedScenarioSec >= 0.3 && elapsedScenarioSec < 0.5) {
          x = 1.2;
          y = 1.5;
          z = 3.9;
          alpha = 60;
          beta = 45;
          gamma = 70;
        } else if (elapsedScenarioSec >= 0.5 && elapsedScenarioSec < 2.5) {
          x = Math.sin(elapsedScenarioSec * 6) * 0.6 + 0.2;
          y = Math.cos(elapsedScenarioSec * 5) * 0.7;
          z = 1.0 + Math.sin(elapsedScenarioSec * 7) * 0.5;
          alpha = 45 * Math.sin(elapsedScenarioSec * 4);
          beta = 35 * Math.cos(elapsedScenarioSec * 4);
          gamma = 50 * Math.sin(elapsedScenarioSec * 3);
        } else {
          x = roadVibeX;
          y = roadVibeY;
          z = roadVibeZ;
        }
      } else if (this.currentScenario === 'SPEED_BUMP_POTHOLE') {
        if (elapsedScenarioSec >= 0.3 && elapsedScenarioSec < 0.6) {
          const bump = Math.sin((elapsedScenarioSec - 0.3) / 0.3 * Math.PI);
          x = roadVibeX + bump * 0.4;
          y = roadVibeY - bump * 0.3;
          z = 1.0 + bump * 1.7;
          beta = bump * 40;
        } else {
          x = roadVibeX;
          y = roadVibeY;
          z = roadVibeZ;
          alpha = baseGyroYaw;
          beta = baseGyroPitch;
          gamma = baseGyroRoll;
        }
      } else {
        x = roadVibeX;
        y = roadVibeY;
        z = roadVibeZ;
        alpha = baseGyroYaw;
        beta = baseGyroPitch;
        gamma = baseGyroRoll;
      }
    }

    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const dynamicAcceleration = Math.abs(magnitude - 1.0);
    const rotationMagnitude = Math.sqrt(alpha * alpha + beta * beta + gamma * gamma);

    return {
      timestamp: now,
      x: round3(x),
      y: round3(y),
      z: round3(z),
      magnitude: round3(magnitude),
      dynamicAcceleration: round3(dynamicAcceleration),
      alpha: round1(alpha),
      beta: round1(beta),
      gamma: round1(gamma),
      rotationMagnitude: round1(rotationMagnitude)
    };
  }
}

export const sensorService = new SensorService();
