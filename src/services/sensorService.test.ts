import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nativeMock = vi.hoisted(() => ({
  isNative: true,
  frameListener: null as null | ((frame: {
    x: number; y: number; z: number; alpha: number; beta: number; gamma: number;
    gyroscopeFresh?: boolean; monotonicTimestampMs: number;
  }) => void),
  start: vi.fn(),
  stop: vi.fn(),
  addListener: vi.fn()
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => nativeMock.isNative,
    getPlatform: () => nativeMock.isNative ? 'android' : 'web'
  },
  registerPlugin: () => ({
    start: nativeMock.start,
    stop: nativeMock.stop,
    addListener: nativeMock.addListener
  })
}));

import { SensorService } from './sensorService';

const validFrame = {
  x: 0.1, y: 0.2, z: 9.7,
  alpha: 1, beta: 2, gamma: 3,
  gyroscopeFresh: true,
  monotonicTimestampMs: 1000
};

describe('SensorService native Android bridge', () => {
  let removeListener: ReturnType<typeof vi.fn>;
  let visibilityCallback: (() => void) | undefined;
  let visibilityDocument: { hidden: boolean; addEventListener: (name: string, callback: () => void) => void };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    vi.stubGlobal('window', globalThis);
    visibilityCallback = undefined;
    visibilityDocument = {
      hidden: false,
      addEventListener: (_name, callback) => { visibilityCallback = callback; }
    };
    vi.stubGlobal('document', visibilityDocument);
    nativeMock.isNative = true;
    nativeMock.frameListener = null;
    removeListener = vi.fn();
    nativeMock.start.mockReset().mockResolvedValue({
      accelerometerAvailable: true,
      gyroscopeAvailable: true,
      backgroundMonitoring: false
    });
    nativeMock.stop.mockReset().mockResolvedValue({ stopped: true });
    nativeMock.addListener.mockReset().mockImplementation(async (_event, callback) => {
      nativeMock.frameListener = callback;
      return { remove: removeListener };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not claim live hardware before a fresh frame', async () => {
    const service = new SensorService();
    await expect(service.requestHardwarePermissions()).resolves.toBe(true);
    expect(service.getIsSimulated()).toBe(true);
    expect(service.getHardwareStatus()).toMatchObject({
      accelerometerAvailable: true,
      gyroscopeAvailable: true,
      active: false,
      simulated: true
    });
  });

  it('activates hardware only after a valid fresh accelerometer frame', async () => {
    const service = new SensorService();
    await service.requestHardwarePermissions();
    nativeMock.frameListener?.(validFrame);
    expect(service.getIsSimulated()).toBe(false);
    expect(service.getHardwareStatus()).toMatchObject({
      active: true,
      gyroscopeActive: true,
      simulated: false
    });
  });

  it('does not claim fresh gyro data from stale zero-filled frames', async () => {
    const service = new SensorService();
    await service.requestHardwarePermissions();
    nativeMock.frameListener?.({ ...validFrame, gyroscopeFresh: false });
    expect(service.getIsSimulated()).toBe(false);
    expect(service.getHardwareStatus()).toMatchObject({
      active: true,
      gyroscopeAvailable: true,
      gyroscopeActive: false
    });
  });

  it('ignores invalid native accelerometer frames', async () => {
    const service = new SensorService();
    await service.requestHardwarePermissions();
    nativeMock.frameListener?.({ ...validFrame, x: Number.NaN });
    expect(service.getIsSimulated()).toBe(true);
  });

  it('falls back to simulation when hardware samples become stale', async () => {
    const service = new SensorService();
    await service.requestHardwarePermissions();
    nativeMock.frameListener?.(validFrame);
    const unsubscribe = service.subscribe(() => {});
    vi.advanceTimersByTime(300);
    expect(service.getIsSimulated()).toBe(true);
    unsubscribe();
  });

  it('stops the native stream when the app is backgrounded', async () => {
    const service = new SensorService();
    await service.requestHardwarePermissions();
    visibilityDocument.hidden = true;
    visibilityCallback?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(nativeMock.stop).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(service.getIsSimulated()).toBe(true);
  });

  it('stops the native stream and removes the listener when simulation is selected', async () => {
    const service = new SensorService();
    await service.requestHardwarePermissions();
    service.setIsSimulated(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(nativeMock.stop).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(service.getIsSimulated()).toBe(true);
  });
});
