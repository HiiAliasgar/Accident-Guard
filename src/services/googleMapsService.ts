import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const STORAGE_KEY = 'accidentguard_google_maps_api_key';

export interface RouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  summary: string;
}

// Night Cockpit HUD Styling for Google Maps (Automotive high-contrast dark theme)
export const GOOGLE_MAPS_COCKPIT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1120' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#14233c' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#0284c7' }] // Vibrant Cyan Arterial Highway
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0369a1' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#e0f2fe' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050b14' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#050b14' }]
  }
];

class GoogleMapsService {
  private loadPromise: Promise<typeof google> | null = null;
  private isLoaded: boolean = false;
  private loadError: string | null = null;

  /**
   * Retrieves the currently active API key (from localStorage or Vite env)
   */
  public getApiKey(): string {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }
    const envKey = (import.meta as unknown as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env?.VITE_GOOGLE_MAPS_API_KEY;
    return (envKey || '').trim();
  }

  /**
   * Stores user API key in localStorage
   */
  public saveApiKey(key: string): void {
    if (typeof window !== 'undefined') {
      const trimmed = key.trim();
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Reset loader if key changes
      this.loadPromise = null;
      this.isLoaded = false;
      this.loadError = null;
    }
  }

  /**
   * Clears user API key
   */
  public clearApiKey(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      this.loadPromise = null;
      this.isLoaded = false;
      this.loadError = null;
    }
  }

  /**
   * Retrieves MapTiler Cloud API Key (from localStorage, .env, or default)
   */
  public getMapTilerKey(): string {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('accidentguard_maptiler_api_key');
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }
    const envKey = (import.meta as unknown as { env?: { VITE_MAPTILER_API_KEY?: string } }).env?.VITE_MAPTILER_API_KEY;
    return (envKey || 'p3XhDE9PeYPWDdg26ZT2').trim();
  }

  public saveMapTilerKey(key: string): void {
    if (typeof window !== 'undefined') {
      const trimmed = key.trim();
      if (trimmed) {
        localStorage.setItem('accidentguard_maptiler_api_key', trimmed);
      } else {
        localStorage.removeItem('accidentguard_maptiler_api_key');
      }
    }
  }

  public clearMapTilerKey(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accidentguard_maptiler_api_key');
    }
  }

  public hasMapTilerKey(): boolean {
    return this.getMapTilerKey().length > 0;
  }

  /**
   * Checks whether an API key is available
   */
  public hasApiKey(): boolean {
    return this.getApiKey().length > 0;
  }

  /**
   * Asynchronously loads the Google Maps JavaScript SDK
   */
  public async loadGoogleMaps(): Promise<typeof google> {
    if (typeof window !== 'undefined' && window.google?.maps) {
      this.isLoaded = true;
      return window.google;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No Google Maps API Key provided. Switch to Leaflet/OpenStreetMap or provide a key.');
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    setOptions({
      key: apiKey,
      v: 'weekly'
    });

    this.loadPromise = (async () => {
      try {
        await importLibrary('maps');
        await importLibrary('geometry');
        this.isLoaded = true;
        this.loadError = null;
        return window.google;
      } catch (err: unknown) {
        this.isLoaded = false;
        this.loadError = err instanceof Error ? err.message : 'Failed to load Google Maps SDK';
        this.loadPromise = null;
        throw err;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Check if SDK is already loaded into window.google
   */
  public isReady(): boolean {
    return typeof window !== 'undefined' && !!window.google?.maps;
  }

  public getLastError(): string | null {
    return this.loadError;
  }

  /**
   * Calculates real-world driving directions from current location to target hospital
   */
  public async calculateHospitalRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<RouteResult | null> {
    if (!this.isReady()) {
      await this.loadGoogleMaps();
    }

    return new Promise((resolve) => {
      const directionsService = new google.maps.DirectionsService();

      directionsService.route(
        {
          origin: new google.maps.LatLng(origin.lat, origin.lng),
          destination: new google.maps.LatLng(destination.lat, destination.lng),
          travelMode: google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result && result.routes[0]) {
            const route = result.routes[0];
            const leg = route.legs[0];

            // Extract lat/lng path coordinates
            const coordinates: [number, number][] = [];
            if (route.overview_path) {
              route.overview_path.forEach((latLng) => {
                coordinates.push([latLng.lat(), latLng.lng()]);
              });
            }

            resolve({
              coordinates,
              distanceKm: leg?.distance?.value ? Number((leg.distance.value / 1000).toFixed(1)) : 0,
              durationMinutes: leg?.duration?.value ? Math.ceil(leg.duration.value / 60) : 0,
              summary: route.summary || 'Fastest emergency route'
            });
          } else {
            console.warn('[GoogleMaps] Directions request failed:', status);
            resolve(null);
          }
        }
      );
    });
  }
}

export const googleMapsService = new GoogleMapsService();
