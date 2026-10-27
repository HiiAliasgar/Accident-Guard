// Location service: GPS retrieval, nearest hospital calculation (Haversine), and SMS payload generation
import { Hospital } from '../types';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// DEMO-ONLY hospital fixtures. These are not verified facilities or contact details.
// Replace with a verified dataset for the actual launch region before any public release.
// No default hospital data: only show facilities from a verified provider.
export const DEFAULT_HOSPITALS: Hospital[] = [];

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates Great-Circle distance between two coordinates using the Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * Finds and sorts nearest hospitals by distance from given coordinates
 */
export function getSortedHospitals(
  coords: Coordinates,
  hospitals: Hospital[] = DEFAULT_HOSPITALS
): Hospital[] {
  return hospitals
    .map((hospital) => {
      const distance = calculateHaversineDistance(
        coords.latitude,
        coords.longitude,
        hospital.latitude,
        hospital.longitude
      );
      // Road ETA is unavailable without a real routing provider.
      const etaMinutes = undefined;
      return {
        ...hospital,
        distanceKm: distance,
        etaMinutes
      };
    })
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

/**
 * Retrieves the device's real GPS position. It rejects on errors and never fabricates coordinates.
 */
export async function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          // Never silently substitute a distant demo coordinate for a failed real GPS fix.
          // Mark the failure by rejecting so callers can present an explicit unavailable state.
          reject(new Error(`Unable to obtain device location: ${error.message || 'permission denied or timeout'}`));
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      reject(new Error('Geolocation is not supported by this environment.'));
    }
  });
}

/**
 * Generates automated emergency dispatch SMS payload
 */
export function generateEmergencySmsPayload(params: {
  userName?: string;
  coords: Coordinates;
  peakG: number;
  nearestHospital: Hospital;
  timestamp: number;
}): {
  recipientNumbers: string[];
  messageText: string;
  mapsUrl: string;
} {
  const { userName = 'AccidentGuard User', coords, peakG, nearestHospital, timestamp } = params;
  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const mapsUrl = `https://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;

  const messageText =
`[ACCIDENTGUARD DEMO — NOT A VERIFIED EMERGENCY ALERT]
This is a demonstration draft from an experimental student prototype.
Driver label: ${userName}
Time: ${timeStr}
Experimental sensor reading: ${peakG.toFixed(1)}g (not validated)
Displayed coordinates: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${coords.accuracy ?? 10}m)
Map link: ${mapsUrl}
Displayed facility: ${nearestHospital.name}
WARNING: No emergency service has been contacted. Verify all information and contact local emergency services directly in a real emergency.`;

  return {
    // No default recipients: never populate fabricated phone numbers.
    recipientNumbers: [],
    messageText,
    mapsUrl
  };
}
