import { describe, expect, it } from 'vitest';
import { calculateHaversineDistance, getSortedHospitals, DEFAULT_HOSPITALS } from './locationService';
import type { Hospital } from '../types';

const hospitals: Hospital[] = [
  { id: 'far', name: 'Far Hospital', address: 'Far', latitude: 20, longitude: 73, phone: '111', traumaLevel: 'Test' },
  { id: 'near', name: 'Near Hospital', address: 'Near', latitude: 19, longitude: 73, phone: '222', traumaLevel: 'Test' },
  { id: 'nearest', name: 'Nearest Hospital', address: 'Nearest', latitude: 19.01, longitude: 73.01, phone: '333', traumaLevel: 'Test' },
];

describe('locationService', () => {
  it('ships no unverified hospital fixtures by default', () => {
    expect(DEFAULT_HOSPITALS).toEqual([]);
  });
  it('returns zero distance for identical coordinates', () => {
    expect(calculateHaversineDistance(19, 73, 19, 73)).toBe(0);
  });

  it('calculates a positive and symmetric great-circle distance', () => {
    const forward = calculateHaversineDistance(19, 73, 20, 74);
    const reverse = calculateHaversineDistance(20, 74, 19, 73);
    expect(forward).toBeGreaterThan(0);
    expect(reverse).toBe(forward);
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
});
