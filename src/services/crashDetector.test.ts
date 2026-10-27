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
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses documented default thresholds', () => {
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
    expect(engine.getState()).toBe('CONFIRMING');
    engine.cancelAlarmByUser();
    expect(engine.getState()).toBe('NORMAL');
    vi.advanceTimersByTime(16000);
    expect(engine.getState()).toBe('NORMAL');
    expect(engine.getIncidentHistory()[0]?.classification).toBe('FALSE_ALARM_USER_CANCELLED');
  });
});
