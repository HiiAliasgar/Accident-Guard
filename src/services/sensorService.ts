// High-frequency (~50Hz) Sensor Telemetry Manager with Real Hardware & Physics Simulation support
import { SensorDataPoint, SimulationScenario } from '../types';

/** Pure arithmetic rounding — avoids parseFloat(toFixed()) string allocation in hot loops */
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round1 = (v: number): number => Math.round(v * 10) / 10;

type SensorCallback = (point: SensorDataPoint) => void;

class SensorService {
  private callbacks: Set<SensorCallback> = new Set();
  private timerId: number | null = null;
  private isSimulated: boolean = true;
  private isHardwareAvailable: boolean = false;
  private hasPermission: boolean = false;
  private hardwareListenerAttached: boolean = false;
  private lastHardwareSampleAt: number = 0;
  private readonly hardwareFreshnessMs = 2000;

  // Real sensor state cache
  private currentRawAccel = { x: 0, y: 0, z: 9.81 };
  private currentRawGyro = { alpha: 0, beta: 0, gamma: 0 };

  // Simulation physics state
  private currentScenario: SimulationScenario = 'NONE';
  private scenarioStartTime: number = 0;
  private simTimeSec: number = 0;

  // Adaptive sampling & battery optimization
  private currentHz: number = 50;
  private isAdaptiveSampling: boolean = true;
  private isPowerSaver: boolean = false;

  // Pre-allocated object to eliminate garbage collection allocations in 50Hz loop
  private reusableSample: SensorDataPoint = {
    timestamp: 0,
    x: 0,
    y: 0,
    z: 1,
    magnitude: 1,
    dynamicAcceleration: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
    rotationMagnitude: 0
  };

  constructor() {
    this.checkHardwareSupport();
  }

  private checkHardwareSupport() {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      this.isHardwareAvailable = true;
      // Capability is not permission or proof of live samples. Always begin in simulation
      // until the user explicitly enables hardware and a fresh event is received.
      this.isSimulated = true;
    } else {
      this.isSimulated = true;
    }
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }

  public getIsHardwareAvailable(): boolean {
    return this.isHardwareAvailable;
  }

  public setIsSimulated(sim: boolean): void {
    if (sim) {
      this.isSimulated = true;
      this.currentScenario = 'NONE';
      return;
    }
    // Keep the UI honest while the permission request is pending. Switch to hardware
    // only after permission succeeds and fresh sensor events begin arriving.
    this.isSimulated = true;
    void this.requestHardwarePermissions().then((granted) => {
      if (!granted) {
        this.isSimulated = true;
      }
    });
  }

  public async requestHardwarePermissions(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!('DeviceMotionEvent' in window) || typeof DeviceMotionEvent === 'undefined') {
      this.isHardwareAvailable = false;
      this.isSimulated = true;
      return false;
    }
    this.isHardwareAvailable = true;
    // iOS 13+ requires explicit permission request
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
      // Non-iOS or standard Android browser
      this.hasPermission = true;
      this.attachHardwareListeners();
      return true;
    }
  }

  private attachHardwareListeners() {
    if (this.hardwareListenerAttached) return;
    this.hardwareListenerAttached = true;
    window.addEventListener('devicemotion', (event) => {
      const receivedAt = Date.now();
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (acc) {
        // Convert to g (1g = 9.80665 m/s²)
        this.currentRawAccel = {
          x: (acc.x || 0) / 9.80665,
          y: (acc.y || 0) / 9.80665,
          z: (acc.z || 9.80665) / 9.80665
        };
      }
      const rot = event.rotationRate;
      if (rot) {
        this.currentRawGyro = {
          alpha: rot.alpha || 0,
          beta: rot.beta || 0,
          gamma: rot.gamma || 0
        };
      }
      if (acc || rot) {
        this.lastHardwareSampleAt = receivedAt;
        this.isSimulated = false;
      }
    });
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

  private adjustSamplingRate(targetHz: number) {
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
    this.isSimulated = true;

    // Burst mode optimization: when an impact occurs, upsample to 60Hz for maximum resolution
    if (this.isAdaptiveSampling) {
      this.adjustSamplingRate(60);
      setTimeout(() => {
        this.adjustSamplingRate(this.isPowerSaver ? 30 : 50);
      }, 5000);
    }
  }

  public getCurrentScenario(): SimulationScenario {
    return this.currentScenario;
  }

  private startSampling() {
    if (this.timerId !== null) return;
    const intervalMs = Math.round(1000 / this.currentHz);

    this.timerId = window.setInterval(() => {
      const now = Date.now();
      const point = this.generateSample(now);
      this.callbacks.forEach((cb) => cb(point));
    }, intervalMs);
  }

  private stopSampling() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Generates or processes a 50Hz sensor telemetry frame
   */
  private generateSample(now: number): SensorDataPoint {
    let x = 0;
    let y = 0;
    let z = 1.0; // standard 1g earth gravity along z-axis
    let alpha = 0;
    let beta = 0;
    let gamma = 0;

    if (!this.isSimulated && this.hasPermission && this.lastHardwareSampleAt > 0 && now - this.lastHardwareSampleAt <= this.hardwareFreshnessMs) {
      // Read actual hardware
      x = this.currentRawAccel.x;
      y = this.currentRawAccel.y;
      z = this.currentRawAccel.z;
      alpha = this.currentRawGyro.alpha;
      beta = this.currentRawGyro.beta;
      gamma = this.currentRawGyro.gamma;
    } else {
      // No permission, unavailable hardware, or stale stream: fall back to clearly labelled simulation.
      if (!this.isSimulated) this.isSimulated = true;
      // Physics Simulation Engine
      this.simTimeSec += 0.02;
      const elapsedScenarioSec = (now - this.scenarioStartTime) / 1000;

      // Base background road vibration / gentle ambient handling
      const roadVibeX = (Math.sin(this.simTimeSec * 14) * 0.06) + (Math.random() - 0.5) * 0.04;
      const roadVibeY = (Math.cos(this.simTimeSec * 11) * 0.05) + (Math.random() - 0.5) * 0.04;
      const roadVibeZ = 1.0 + (Math.sin(this.simTimeSec * 18) * 0.08) + (Math.random() - 0.5) * 0.05;

      const baseGyroYaw = Math.sin(this.simTimeSec * 2) * 5 + (Math.random() - 0.5) * 4;
      const baseGyroPitch = Math.cos(this.simTimeSec * 1.5) * 4 + (Math.random() - 0.5) * 3;
      const baseGyroRoll = Math.sin(this.simTimeSec * 3) * 3 + (Math.random() - 0.5) * 3;

      if (this.currentScenario === 'HEAD_ON_COLLISION') {
        // Timeline:
        // 0.0s - 0.4s: Cruising
        // 0.4s - 0.8s: Violent Frontal Impact deceleration spike (up to 4.8g)
        // 0.8s - 4.5s: Complete vehicle stillness (car stopped dead)
        if (elapsedScenarioSec < 0.4) {
          x = roadVibeX;
          y = roadVibeY + 0.15; // gentle cruising acceleration
          z = roadVibeZ;
          alpha = baseGyroYaw;
          beta = baseGyroPitch;
          gamma = baseGyroRoll;
        } else if (elapsedScenarioSec >= 0.4 && elapsedScenarioSec < 0.75) {
          // Sharp impact phase
          const peakProgress = (elapsedScenarioSec - 0.4) / 0.35;
          const impactProfile = Math.sin(peakProgress * Math.PI);
          x = roadVibeX + impactProfile * 1.4;
          y = -4.6 * impactProfile + (Math.random() - 0.5) * 0.4; // rapid negative deceleration spike
          z = 1.0 + impactProfile * 2.1;
          alpha = impactProfile * 160 + (Math.random() - 0.5) * 20;
          beta = -impactProfile * 220 + (Math.random() - 0.5) * 20;
          gamma = impactProfile * 140;
        } else {
          // Post-impact immobilised stillness (very low variance, vehicle halted)
          x = (Math.random() - 0.5) * 0.02;
          y = (Math.random() - 0.5) * 0.02;
          z = 0.98 + (Math.random() - 0.5) * 0.02;
          alpha = (Math.random() - 0.5) * 1.5;
          beta = (Math.random() - 0.5) * 1.5;
          gamma = (Math.random() - 0.5) * 1.5;
        }
      } else if (this.currentScenario === 'ROLLOVER_CRASH') {
        // Multi-axis violent tumbling: sustained angular velocity > 300 deg/s and spikes > 3.8g
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
          gamma = 420 * Math.sin(t * 9); // violent roll
        } else {
          // Resting on side/roof: orientation shifted, zero movement
          x = 0.88 + (Math.random() - 0.5) * 0.02;
          y = 0.42 + (Math.random() - 0.5) * 0.02;
          z = 0.15 + (Math.random() - 0.5) * 0.02;
          alpha = (Math.random() - 0.5) * 1;
          beta = (Math.random() - 0.5) * 1;
          gamma = (Math.random() - 0.5) * 1;
        }
      } else if (this.currentScenario === 'PHONE_DROP_REJECTION') {
        // Demonstrates FALSE POSITIVE REJECTION:
        // Phone hits carpet or desk (spike 4.2g), but is immediately picked up or keeps moving/bouncing
        if (elapsedScenarioSec < 0.3) {
          x = roadVibeX;
          y = roadVibeY;
          z = roadVibeZ;
        } else if (elapsedScenarioSec >= 0.3 && elapsedScenarioSec < 0.5) {
          // Sharp impact spike
          x = 1.2;
          y = 1.5;
          z = 3.9; // hits surface
          alpha = 60;
          beta = 45;
          gamma = 70; // low sustained tumble
        } else if (elapsedScenarioSec >= 0.5 && elapsedScenarioSec < 2.5) {
          // User immediately picks phone up, walking, fidgeting -> high variance (NOT still)
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
        // Rough road / pothole bump: spike reaches ~1.8g (below 3.5g crash threshold), returns to driving
        if (elapsedScenarioSec >= 0.3 && elapsedScenarioSec < 0.6) {
          const bump = Math.sin((elapsedScenarioSec - 0.3) / 0.3 * Math.PI);
          x = roadVibeX + bump * 0.4;
          y = roadVibeY - bump * 0.3;
          z = 1.0 + bump * 1.7; // ~2.7g peak, below 3.5g
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
        // Default normal driving
        x = roadVibeX;
        y = roadVibeY;
        z = roadVibeZ;
        alpha = baseGyroYaw;
        beta = baseGyroPitch;
        gamma = baseGyroRoll;
      }
    }

    // Magnitude: sqrt(x² + y² + z²)
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const dynamicAcceleration = Math.abs(magnitude - 1.0);
    const rotationMagnitude = Math.sqrt(alpha * alpha + beta * beta + gamma * gamma);

    // OPTIMIZATION: Mutate pre-allocated object (zero GC pressure in 50Hz loop)
    const s = this.reusableSample;
    s.timestamp = now;
    s.x = round3(x);
    s.y = round3(y);
    s.z = round3(z);
    s.magnitude = round3(magnitude);
    s.dynamicAcceleration = round3(dynamicAcceleration);
    s.alpha = round1(alpha);
    s.beta = round1(beta);
    s.gamma = round1(gamma);
    s.rotationMagnitude = round1(rotationMagnitude);
    return s;
  }
}

export const sensorService = new SensorService();
