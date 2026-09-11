// Location service: GPS retrieval, nearest hospital calculation (Haversine), and SMS payload generation
import { Hospital } from '../types';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// Sample hospitals database (representing nearby emergency trauma centers)
export const DEFAULT_HOSPITALS: Hospital[] = [
  {
    id: 'hosp-1',
    name: 'Metropolitan Level-1 Trauma Center',
    address: '1001 Potrero Ave, San Francisco, CA 94110',
    latitude: 37.7558,
    longitude: -122.4045,
    phone: '+1 (415) 206-8000',
    traumaLevel: 'Level 1 Trauma & Comprehensive Stroke'
  },
  {
    id: 'hosp-2',
    name: 'St. Jude Regional Emergency Hospital',
    address: '350 Parnassus Ave, San Francisco, CA 94143',
    latitude: 37.7631,
    longitude: -122.4578,
    phone: '+1 (415) 353-1000',
    traumaLevel: 'Level 2 Trauma & Cardiac Care'
  },
  {
    id: 'hosp-3',
    name: 'Civic Urgent Care & Acute Trauma Annex',
    address: '900 Hyde St, San Francisco, CA 94109',
    latitude: 37.7905,
    longitude: -122.4172,
    phone: '+1 (415) 775-4321',
    traumaLevel: 'Level 3 Acute Emergency'
  },
  {
    id: 'hosp-4',
    name: 'Bay Area Emergency Response Hub',
    address: '1600 Divisadero St, San Francisco, CA 94115',
    latitude: 37.7854,
    longitude: -122.4402,
    phone: '+1 (415) 567-6600',
    traumaLevel: 'Emergency Medical Dispatch'
  }
];

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
      // Rough ETA estimate: assuming average emergency transit speed of 45 km/h in city
      const etaMinutes = Math.max(3, Math.round((distance / 45) * 60) + 2);
      return {
        ...hospital,
        distanceKm: distance,
        etaMinutes
      };
    })
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

/**
 * Retrieves the device's real GPS position or falls back to standard demo coordinates
 */
export async function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        () => {
          // Fallback to default urban demo location (San Francisco Civic Center)
          resolve({
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 15
          });
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      resolve({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 25
      });
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
`🚨 [ACCIDENTGUARD EMERGENCY DISPATCH] 🚨
CRITICAL VEHICULAR IMPACT DETECTED!
Driver: ${userName}
Time: ${timeStr}
Peak Impact: ${peakG.toFixed(1)}g (Severe Collision)
GPS Location: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${coords.accuracy ?? 10}m)
Live Map: ${mapsUrl}
Nearest Trauma Center: ${nearestHospital.name} (ETA ~${nearestHospital.etaMinutes ?? 5} min)
Hospital Hotline: ${nearestHospital.phone}
Please dispatch emergency medical services (EMS) immediately!`;

  return {
    recipientNumbers: [nearestHospital.phone, '+1 (555) 911-0199', '+1 (555) 234-5678'],
    messageText,
    mapsUrl
  };
}
