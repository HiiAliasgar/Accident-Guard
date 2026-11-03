import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateHaversineDistance, getCurrentCoordinates, getSortedHospitals, DEFAULT_HOSPITALS } from './locationService';
import type { Hospital } from '../types';

const platform = vi.hoisted(() => ({ native: false }));
const geo = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn()
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native }
}));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: geo }));

const hospitals: Hospital[] = [
  { id: 'far', name: 'Far Hospital', address: 'Far', latitude: 20, longitude: 73, phone: '111', traumaLevel: 'Test' },
  { id: 'near', name: 'Near Hospital', address: 'Near', latitude: 19, longitude: 73, phone: '222', traumaLevel: 'Test' },
  { id: 'nearest', name: 'Nearest Hospital', address: 'Nearest', latitude: 19.01, longitude: 73.01, phone: '333', traumaLevel: 'Test' }
];

describe('locationService', () => {
  beforeEach(() => {
    platform.native = false;
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ships no unverified hospital fixtures by default', () => {
    expect(DEFAULT_HOSPITALS).toEqual([]);
  });

  it('returns zero distance for identical coordinates', () => {
    expect(calculateHaversineDistance(19, 73, 19, 73)).toBe(0);
  });

  it('calculates positive symmetric great-circle distance', () => {
    const distance = calculateHaversineDistance(19, 73, 20, 74);
    expect(distance).toBeGreaterThan(0);
    expect(calculateHaversineDistance(20, 74, 19, 73)).toBe(distance);
  });

  it('sorts facilities by straight-line distance without inventing road ETA', () => {
    const sorted = getSortedHospitals({ latitude: 19, longitude: 73 }, hospitals);
    expect(sorted.map((hospital) => hospital.id)).toEqual(['near', 'nearest', 'far']);
    expect(sorted.every((hospital) => hospital.etaMinutes === undefined)).toBe(true);
  });

  it('does not mutate the provided hospital list', () => {
    const original = hospitals.map((hospital) => hospital.id);
    getSortedHospitals({ latitude: 19, longitude: 73 }, hospitals);
    expect(hospitals.map((hospital) => hospital.id)).toEqual(original);
  });

  it('uses browser geolocation on web', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success) => success({
          coords: { latitude: 19.1, longitude: 73.0, accuracy: 12 }
        }))
      }
    });
    await expect(getCurrentCoordinates()).resolves.toEqual({
      latitude: 19.1, longitude: 73.0, accuracy: 12
    });
  });

  it('requests native permission and uses Capacitor GPS on Android', async () => {
    platform.native = true;
    geo.checkPermissions.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    geo.requestPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    geo.getCurrentPosition.mockResolvedValue({
      coords: { latitude: 19.2, longitude: 73.1, accuracy: 8 }
    });
    await expect(getCurrentCoordinates()).resolves.toEqual({
      latitude: 19.2, longitude: 73.1, accuracy: 8
    });
    expect(geo.requestPermissions).toHaveBeenCalledWith({ permissions: ['location'] });
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(expect.objectContaining({
      enableHighAccuracy: true, maximumAge: 0
    }));
  });

  it('rejects denied native permission without fabricated coordinates', async () => {
    platform.native = true;
    geo.checkPermissions.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    geo.requestPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
    await expect(getCurrentCoordinates()).rejects.toThrow('Location permission was not granted');
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });
});
