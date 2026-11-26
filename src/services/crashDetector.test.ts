import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashDetectionEngine, DEFAULT_THRESHOLDS } from './crashDetector';
import { emergencyAudio } from './audioService';
import type { SensorDataPoint } from '../types';

vi.mock('./audioService', () => ({
  emergencyAudio: {
    startSiren: vi.fn(),
    playImpactAlert: vi.fn(),
    stopSiren: vi.fn(),
    playCountdownBeep: vi.fn(),
    playCancelChime: vi.fn(),
  },
}));
vi.mock('./locationService', () => ({
  getCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 19, longitude: 73, accuracy: 10 }),
  DEFAULT_HOSPITALS: [{
    id: 'test-hospital', name: 'Test Hospital', address: 'Test Address',
    latitude: 19.01, longitude: 73.01, phone: '000', traumaLevel: 'Test'
  }],
  getSortedHospitals: vi.fn().mockReturnValue([{
    id: 'test-hospital', name: 'Test Hospital', address: 'Test Address',
    latitude: 19.01, longitude: 73.01, phone: '000', traumaLevel: 'Test', distanceKm: 1, etaMinutes: 5
  }]),
}));

const frame = (timestamp: number, magnitude: number, rotationMagnitude: number): SensorDataPoint => ({
  timestamp,
  x: 0,
  y: 0,
  z: magnitude,
  magnitude,
  dynamicAcceleration: Math.abs(magnitude - 1),
  alpha: 0,
  beta: 0,
  gamma: 0,
  rotationMagnitude,
});

describe('CrashDetectionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses documented default thresholds including adaptiveSampling and powerSaverMode', () => {
    const engine = new CrashDetectionEngine();
    expect(engine.getThresholds()).toEqual(DEFAULT_THRESHOLDS);
  });

  it('does not trigger on samples below the impact threshold', () => {
    const engine = new CrashDetectionEngine();
    engine.processSensorFrame(frame(1000, 3.49, 500));
    expect(engine.getState()).toBe('NORMAL');
  });

  it('moves into impact detected when threshold is reached', () => {
    const engine = new CrashDetectionEngine();
    engine.processSensorFrame(frame(1000, 3.5, 0));
    expect(engine.getState()).toBe('IMPACT_DETECTED');
    expect(emergencyAudio.playImpactAlert).toHaveBeenCalledTimes(1);
  });

  it('cancels countdown, restores normal state and clears timer', () => {
    const engine = new CrashDetectionEngine({ countdownDurationSec: 15 });
    engine.triggerManualCrashDemo();
    expect(engine.getState()).toBe('COUNTDOWN');
    engine.cancelAlarmByUser();
    expect(engine.getState()).toBe('NORMAL');
    vi.advanceTimersByTime(16000);
    expect(engine.getState()).toBe('NORMAL');
    expect(engine.getIncidentHistory()[0]?.classification).toBe('FALSE_ALARM_USER_CANCELLED');
  });

  it('transitions through IMPACT_DETECTED -> CONFIRMING -> COUNTDOWN -> ALERT_TRIGGERED as SEVERE_COLLISION', async () => {
    const engine = new CrashDetectionEngine({ countdownDurationSec: 5 });
    engine.processSensorFrame(frame(1000, 4.2, 220));
    expect(engine.getState()).toBe('IMPACT_DETECTED');

    engine.processSensorFrame(frame(1500, 1.0, 0));
    expect(engine.getState()).toBe('CONFIRMING');

    for (let t = 1600; t <= 4200; t += 100) {
      engine.processSensorFrame(frame(t, 1.0, 0));
    }
    expect(engine.getState()).toBe('COUNTDOWN');

    await vi.advanceTimersByTimeAsync(5000);
    expect(engine.getState()).toBe('ALERT_TRIGGERED');
    expect(engine.getIncidentHistory()[0]?.classification).toBe('SEVERE_COLLISION');
    expect(engine.getIncidentHistory()[0]?.locationStatus).toBe('VERIFIED');
  });

  it('rejects phone-drop false positives when post-impact motion continues', () => {
    const engine = new CrashDetectionEngine();
    engine.processSensorFrame(frame(1000, 4.1, 200));
    engine.processSensorFrame(frame(1500, 1.0, 0));
    expect(engine.getState()).toBe('CONFIRMING');

    for (let i = 0; i < 30; i++) {
      const mag = i % 2 === 0 ? 1.8 : 0.4;
      engine.processSensorFrame(frame(1600 + i * 100, mag, 20));
    }
    expect(engine.getState()).toBe('NORMAL');
    expect(engine.getIncidentHistory()[0]?.classification).toBe('FALSE_ALARM_STILLNESS_FAILED');
  });

  it('rejects confirmation when insufficient post-impact samples arrive (sensor dropout)', () => {
    const engine = new CrashDetectionEngine();
    engine.processSensorFrame(frame(1000, 4.2, 220));
    engine.processSensorFrame(frame(1500, 1.0, 0));
    expect(engine.getState()).toBe('CONFIRMING');

    // Jump straight to 4200ms with only 2 post-impact samples
    engine.processSensorFrame(frame(4200, 1.0, 0));
    expect(engine.getState()).toBe('NORMAL');
    expect(engine.getIncidentHistory()[0]?.classification).toBe('FALSE_ALARM_STILLNESS_FAILED');
  });

  it('rejects pothole / speed-bump spikes below impactThresholdG', () => {
    const engine = new CrashDetectionEngine();
    engine.processSensorFrame(frame(1000, 2.7, 40));
    expect(engine.getState()).toBe('NORMAL');
  });

  it('classifies rollover when peakRotation > 300 deg/s and resets cleanly', async () => {
    const engine = new CrashDetectionEngine({ countdownDurationSec: 3 });
    engine.processSensorFrame(frame(1000, 4.0, 420));
    engine.processSensorFrame(frame(1500, 1.0, 0));
    for (let t = 1600; t <= 4200; t += 100) {
      engine.processSensorFrame(frame(t, 1.0, 0));
    }
    await vi.advanceTimersByTimeAsync(3000);
    expect(engine.getIncidentHistory()[0]?.classification).toBe('ROLLOVER');

    engine.reset();
    expect(engine.getState()).toBe('NORMAL');
  });

  it('stops countdown and siren on triggerImmediateDispatch()', async () => {
    const engine = new CrashDetectionEngine({ countdownDurationSec: 10 });
    engine.triggerManualCrashDemo();
    expect(engine.getState()).toBe('COUNTDOWN');

    await engine.triggerImmediateDispatch();
    expect(engine.getState()).toBe('DISPATCHED');
    expect(emergencyAudio.stopSiren).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(11000);
    expect(engine.getState()).toBe('DISPATCHED');
  });

  it('records null location when GPS fails instead of 0,0 or demo coordinates', async () => {
    const { getCurrentCoordinates } = await import('./locationService');
    vi.mocked(getCurrentCoordinates).mockRejectedValueOnce(new Error('GPS denied'));
    const engine = new CrashDetectionEngine({ countdownDurationSec: 2 });
    engine.triggerManualCrashDemo();
    await vi.advanceTimersByTimeAsync(2000);
    expect(engine.getState()).toBe('ALERT_TRIGGERED');
    expect(engine.getIncidentHistory()[0]?.location).toBeNull();
    expect(engine.getIncidentHistory()[0]?.locationStatus).toBe('UNAVAILABLE');
  });
});
