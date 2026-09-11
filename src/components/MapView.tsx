// Dual-Engine Automotive Navigation Map: Official Google Maps Platform with Leaflet/OpenStreetMap Fallback
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { Hospital, RoadAlert, MapEngine } from '../types';
import { Layers, Navigation, ZoomIn, ZoomOut, Globe, MapPin } from 'lucide-react';
import { googleMapsService, GOOGLE_MAPS_COCKPIT_STYLE } from '../services/googleMapsService';

interface MapViewProps {
  latitude: number;
  longitude: number;
  heading?: number;
  speedKmH?: number;
  hospitals?: Hospital[];
  roadAlerts?: RoadAlert[];
  routeCoordinates?: [number, number][];
  selectedHospitalId?: string;
  zoom?: number;
  height?: string;
  isCockpitMode?: boolean;
  engine?: MapEngine;
  onEngineToggle?: (newEngine: MapEngine) => void;
  onOpenSettings?: () => void;
}

type TileLayerTheme = 'google_streets' | 'cockpit_dark' | 'satellite_hybrid';

const getTileProviders = (mapTilerKey: string): Record<TileLayerTheme, { name: string; url: string; subdomains?: string; maxZoom: number }> => ({
  google_streets: {
    name: mapTilerKey ? 'MapTiler Streets' : 'Google Streets',
    url: mapTilerKey
      ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20
  },
  cockpit_dark: {
    name: mapTilerKey ? 'MapTiler Dark' : 'Cockpit Night',
    url: mapTilerKey
      ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${mapTilerKey}`
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20
  },
  satellite_hybrid: {
    name: mapTilerKey ? 'MapTiler Satellite' : 'Satellite View',
    url: mapTilerKey
      ? `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${mapTilerKey}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19
  }
});

export const MapView: React.FC<MapViewProps> = ({
  latitude,
  longitude,
  heading = 0,
  speedKmH = 0,
  hospitals = [],
  roadAlerts = [],
  routeCoordinates = [],
  zoom = 15,
  height = '360px',
  isCockpitMode = false,
  engine = 'auto',
  onEngineToggle,
  onOpenSettings
}) => {
  // Container Refs
  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const googleContainerRef = useRef<HTMLDivElement | null>(null);

  // Leaflet Refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const leafletMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const leafletRoutePolylineRef = useRef<L.Polyline | null>(null);
  const leafletVehicleMarkerRef = useRef<L.Marker | null>(null);

  // Google Maps Refs
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googleRoutePolylineRef = useRef<google.maps.Polyline | null>(null);
  const googleVehicleMarkerRef = useRef<google.maps.Marker | null>(null);
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // State
  const [activeTheme, setActiveTheme] = useState<TileLayerTheme>('cockpit_dark');
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState<boolean>(() => googleMapsService.isReady());
  const [googleLoadFailed, setGoogleLoadFailed] = useState<boolean>(false);

  // MapTiler & Engine Resolution
  const mapTilerKey = googleMapsService.getMapTilerKey();
  const tileProviders = getTileProviders(mapTilerKey);

  // Determine active engine
  const hasApiKey = googleMapsService.hasApiKey();
  const wantsGoogle = engine === 'google' || (engine === 'auto' && hasApiKey);
  const activeEngine: 'google' | 'leaflet' = wantsGoogle && isGoogleLoaded && !googleLoadFailed ? 'google' : 'leaflet';

  // OPTIMIZATION: Stable serialization keys to prevent marker rebuild on every telemetry tick
  const hospitalMarkerKey = useMemo(
    () => hospitals.map(h => `${h.id}:${h.distanceKm}:${h.etaMinutes}`).join('|'),
    [hospitals]
  );
  const hazardMarkerKey = useMemo(
    () => roadAlerts.map(a => `${a.id}:${a.distanceMeters}`).join('|'),
    [roadAlerts]
  );

  // Load Google Maps SDK if requested
  useEffect(() => {
    if (wantsGoogle && !isGoogleLoaded && !googleLoadFailed) {
      googleMapsService
        .loadGoogleMaps()
        .then(() => {
          setIsGoogleLoaded(true);
          setGoogleLoadFailed(false);
        })
        .catch((err) => {
          console.warn('[MapView] Google Maps load failed, falling back to Leaflet:', err);
          setGoogleLoadFailed(true);
        });
    }
  }, [wantsGoogle, isGoogleLoaded, googleLoadFailed]);

  // ==========================================
  // 1. LEAFLET ENGINE IMPLEMENTATION
  // ==========================================
  useEffect(() => {
    if (activeEngine !== 'leaflet') {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletVehicleMarkerRef.current = null;
        leafletRoutePolylineRef.current = null;
      }
      return;
    }

    if (!leafletContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(leafletContainerRef.current, {
        center: [latitude, longitude],
        zoom: zoom,
        zoomControl: false,
        attributionControl: false
      });

      const provider = tileProviders[activeTheme];
      const tileLayer = L.tileLayer(provider.url, {
        maxZoom: provider.maxZoom,
        subdomains: provider.subdomains ?? 'abc'
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      const markersGroup = L.layerGroup().addTo(map);
      leafletMarkersGroupRef.current = markersGroup;
      leafletMapRef.current = map;
    }
  }, [activeEngine]);

  // Leaflet: Theme Change
  useEffect(() => {
    if (activeEngine !== 'leaflet' || !leafletMapRef.current || !tileLayerRef.current) return;
    const provider = tileProviders[activeTheme];
    leafletMapRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(provider.url, {
      maxZoom: provider.maxZoom,
      subdomains: provider.subdomains ?? 'abc'
    }).addTo(leafletMapRef.current);
    tileLayerRef.current = newLayer;
  }, [activeTheme, activeEngine, mapTilerKey]);

  // Leaflet: Polyline
  useEffect(() => {
    if (activeEngine !== 'leaflet' || !leafletMapRef.current) return;
    if (routeCoordinates && routeCoordinates.length > 1) {
      if (leafletRoutePolylineRef.current) {
        leafletRoutePolylineRef.current.setLatLngs(routeCoordinates);
      } else {
        const polyline = L.polyline(routeCoordinates, {
          color: '#00f0ff',
          weight: 6,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(leafletMapRef.current);
        leafletRoutePolylineRef.current = polyline;
      }
    }
  }, [routeCoordinates, activeEngine]);

  // Leaflet: Vehicle Marker & Follow
  useEffect(() => {
    if (activeEngine !== 'leaflet' || !leafletMapRef.current || !leafletMarkersGroupRef.current) return;

    if (autoFollow) {
      leafletMapRef.current.panTo([latitude, longitude], { animate: true, duration: 0.3 });
    }

    const carHtml = `
      <div class="nav-vehicle-anchor">
        <div class="nav-heading-cone" style="transform: rotate(${heading}deg);"></div>
        <div class="nav-vehicle-beacon ${speedKmH > 0 ? 'moving' : 'idle'}">
          <div class="nav-pulse-ring"></div>
          <div class="nav-car-core">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" transform="rotate(${heading} 12 12)"/>
            </svg>
          </div>
        </div>
      </div>
    `;

    const vehicleIcon = L.divIcon({
      className: 'custom-nav-vehicle-pin',
      html: carHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (leafletVehicleMarkerRef.current) {
      leafletVehicleMarkerRef.current.setLatLng([latitude, longitude]);
      leafletVehicleMarkerRef.current.setIcon(vehicleIcon);
    } else {
      const marker = L.marker([latitude, longitude], { icon: vehicleIcon, zIndexOffset: 1000 })
        .bindPopup(`<strong>Active Navigation</strong><br>Speed: ${speedKmH} km/h • Heading: ${heading}°`)
        .addTo(leafletMarkersGroupRef.current);
      leafletVehicleMarkerRef.current = marker;
    }
  }, [latitude, longitude, heading, speedKmH, autoFollow, activeEngine]);

  // Leaflet: Hospitals and Road Hazards
  useEffect(() => {
    if (activeEngine !== 'leaflet' || !leafletMarkersGroupRef.current) return;

    leafletMarkersGroupRef.current.eachLayer((layer) => {
      if (layer !== leafletVehicleMarkerRef.current) {
        leafletMarkersGroupRef.current?.removeLayer(layer);
      }
    });

    // Hospital Pins
    hospitals.forEach((hosp) => {
      const hospIcon = L.divIcon({
        className: 'custom-hospital-map-pin',
        html: `
          <div class="hospital-pin-wrapper">
            <div class="hospital-pulse"></div>
            <div class="hospital-badge">
              <span class="hospital-cross">+</span>
            </div>
            <div class="hospital-label-bubble">
              ${hosp.name.split(' ')[0]}
            </div>
          </div>
        `,
        iconSize: [36, 44],
        iconAnchor: [18, 44]
      });

      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-header hospital">
            <span class="popup-tag">${hosp.traumaLevel}</span>
            <h4 class="popup-title">${hosp.name}</h4>
          </div>
          <p class="popup-address">${hosp.address}</p>
          <div class="popup-stats">
            <span><strong>Distance:</strong> ${hosp.distanceKm ?? 0} km</span>
            <span><strong>ETA:</strong> ~${hosp.etaMinutes ?? 5} min</span>
          </div>
          <a href="tel:${hosp.phone}" class="popup-action-btn">
            📞 Call Emergency Desk (${hosp.phone})
          </a>
        </div>
      `;

      L.marker([hosp.latitude, hosp.longitude], { icon: hospIcon })
        .bindPopup(popupHtml)
        .addTo(leafletMarkersGroupRef.current!);
    });

    // Hazard Pins
    roadAlerts.forEach((alert) => {
      const isCritical = alert.severity === 'CRITICAL';
      const iconSymbol = alert.type === 'ACCIDENT_BLACKSPOT' ? '⚠️' : 
                         alert.type === 'CONSTRUCTION' ? '🚧' : 
                         alert.type === 'SPEED_CAMERA' ? '📷' : 
                         alert.type === 'SHARP_CURVE' ? '⚡' : '🌧️';

      const hazardIcon = L.divIcon({
        className: 'custom-road-hazard-pin',
        html: `
          <div class="hazard-pin-wrapper ${alert.severity.toLowerCase()}">
            <div class="hazard-pulse-ring"></div>
            <div class="hazard-badge">
              <span>${iconSymbol}</span>
            </div>
            <div class="hazard-distance-tag">
              ${alert.distanceMeters > 0 ? `${alert.distanceMeters}m` : 'Ahead'}
            </div>
          </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 40]
      });

      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-header ${isCritical ? 'critical' : 'warning'}">
            <span class="popup-tag">${alert.severity} ROAD ALERT</span>
            <h4 class="popup-title">${alert.title}</h4>
          </div>
          <p class="popup-desc">${alert.description}</p>
          <div class="popup-stats">
            <span><strong>Road:</strong> ${alert.roadName}</span>
            <span><strong>Speed Limit:</strong> ${alert.speedLimitKmH} km/h</span>
            ${alert.recommendedSpeedKmH ? `<span><strong>Advisory:</strong> ${alert.recommendedSpeedKmH} km/h</span>` : ''}
          </div>
        </div>
      `;

      L.marker([alert.latitude, alert.longitude], { icon: hazardIcon })
        .bindPopup(popupHtml)
        .addTo(leafletMarkersGroupRef.current!);
    });
  }, [hospitalMarkerKey, hazardMarkerKey, activeEngine]);

  // ==========================================
  // 2. GOOGLE MAPS PLATFORM IMPLEMENTATION
  // ==========================================
  useEffect(() => {
    if (activeEngine !== 'google' || !googleContainerRef.current || !window.google?.maps) return;

    if (!googleMapRef.current) {
      const mapOptions: google.maps.MapOptions = {
        center: { lat: latitude, lng: longitude },
        zoom: zoom,
        disableDefaultUI: true,
        styles: activeTheme === 'cockpit_dark' ? GOOGLE_MAPS_COCKPIT_STYLE : [],
        mapTypeId: activeTheme === 'satellite_hybrid' ? 'hybrid' : 'roadmap'
      };

      const gMap = new google.maps.Map(googleContainerRef.current, mapOptions);
      googleMapRef.current = gMap;
    }
  }, [activeEngine]);

  // Google Maps: Theme Switcher
  useEffect(() => {
    if (activeEngine !== 'google' || !googleMapRef.current) return;
    if (activeTheme === 'cockpit_dark') {
      googleMapRef.current.setOptions({
        styles: GOOGLE_MAPS_COCKPIT_STYLE,
        mapTypeId: 'roadmap'
      });
    } else if (activeTheme === 'google_streets') {
      googleMapRef.current.setOptions({
        styles: [],
        mapTypeId: 'roadmap'
      });
    } else if (activeTheme === 'satellite_hybrid') {
      googleMapRef.current.setOptions({
        styles: [],
        mapTypeId: 'hybrid'
      });
    }
  }, [activeTheme, activeEngine]);

  // Google Maps: Polyline
  useEffect(() => {
    if (activeEngine !== 'google' || !googleMapRef.current || !window.google?.maps) return;

    if (routeCoordinates && routeCoordinates.length > 1) {
      const path = routeCoordinates.map(([lat, lng]) => ({ lat, lng }));
      if (googleRoutePolylineRef.current) {
        googleRoutePolylineRef.current.setPath(path);
      } else {
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#00f0ff',
          strokeOpacity: 0.95,
          strokeWeight: 6,
          map: googleMapRef.current
        });
        googleRoutePolylineRef.current = polyline;
      }
    }
  }, [routeCoordinates, activeEngine]);

  // Google Maps: Vehicle Marker & Follow
  useEffect(() => {
    if (activeEngine !== 'google' || !googleMapRef.current || !window.google?.maps) return;

    const pos = { lat: latitude, lng: longitude };
    if (autoFollow) {
      googleMapRef.current.panTo(pos);
    }

    const navArrowIcon: google.maps.Symbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 6,
      rotation: heading,
      fillColor: '#00f0ff',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      anchor: new google.maps.Point(0, 2.5)
    };

    if (googleVehicleMarkerRef.current) {
      googleVehicleMarkerRef.current.setPosition(pos);
      googleVehicleMarkerRef.current.setIcon(navArrowIcon);
    } else {
      const marker = new google.maps.Marker({
        position: pos,
        map: googleMapRef.current,
        icon: navArrowIcon,
        title: `Vehicle: ${speedKmH} km/h (${heading}°)`,
        zIndex: 9999
      });
      googleVehicleMarkerRef.current = marker;
    }
  }, [latitude, longitude, heading, speedKmH, autoFollow, activeEngine]);

  // Google Maps: Hospital & Hazard Markers
  useEffect(() => {
    if (activeEngine !== 'google' || !googleMapRef.current || !window.google?.maps) return;

    // Clear old markers
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];

    // Hospitals
    hospitals.forEach((hosp) => {
      const marker = new google.maps.Marker({
        position: { lat: hosp.latitude, lng: hosp.longitude },
        map: googleMapRef.current!,
        title: hosp.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#ef4444',
          fillOpacity: 0.95,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const infoContent = `
        <div style="color: #0f172a; padding: 6px 8px; font-family: sans-serif; max-width: 240px;">
          <div style="font-weight: 800; font-size: 13px; color: #b91c1c;">${hosp.name}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">${hosp.address}</div>
          <div style="font-size: 11px; font-weight: bold; margin-top: 4px; color: #0284c7;">
            ${hosp.traumaLevel} • Dist: ${hosp.distanceKm ?? 0} km • ETA: ~${hosp.etaMinutes ?? 5}m
          </div>
          <div style="margin-top: 6px;">
            <a href="tel:${hosp.phone}" style="display: inline-block; background: #0284c7; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; text-decoration: none; font-weight: bold;">
              📞 Call ${hosp.phone}
            </a>
          </div>
        </div>
      `;

      marker.addListener('click', () => {
        if (activeInfoWindowRef.current) activeInfoWindowRef.current.close();
        const infoWindow = new google.maps.InfoWindow({ content: infoContent });
        infoWindow.open(googleMapRef.current, marker);
        activeInfoWindowRef.current = infoWindow;
      });

      googleMarkersRef.current.push(marker);
    });

    // Hazards
    roadAlerts.forEach((alert) => {
      const isCritical = alert.severity === 'CRITICAL';
      const marker = new google.maps.Marker({
        position: { lat: alert.latitude, lng: alert.longitude },
        map: googleMapRef.current!,
        title: alert.title,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: isCritical ? '#dc2626' : '#d97706',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5
        }
      });

      const infoContent = `
        <div style="color: #0f172a; padding: 6px 8px; font-family: sans-serif; max-width: 220px;">
          <div style="font-weight: 800; font-size: 12px; color: ${isCritical ? '#dc2626' : '#d97706'};">
            ${alert.severity} ROAD ALERT
          </div>
          <div style="font-weight: bold; font-size: 12px; margin-top: 2px;">${alert.title}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">${alert.description}</div>
          <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">Speed Limit: ${alert.speedLimitKmH} km/h</div>
        </div>
      `;

      marker.addListener('click', () => {
        if (activeInfoWindowRef.current) activeInfoWindowRef.current.close();
        const infoWindow = new google.maps.InfoWindow({ content: infoContent });
        infoWindow.open(googleMapRef.current, marker);
        activeInfoWindowRef.current = infoWindow;
      });

      googleMarkersRef.current.push(marker);
    });
  }, [hospitalMarkerKey, hazardMarkerKey, activeEngine]);

  // Clean up Leaflet and Google Maps on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      // Clean up Google Maps markers
      googleMarkersRef.current.forEach((m) => m.setMap(null));
      googleMarkersRef.current = [];
      if (googleRoutePolylineRef.current) {
        googleRoutePolylineRef.current.setMap(null);
        googleRoutePolylineRef.current = null;
      }
      if (googleVehicleMarkerRef.current) {
        googleVehicleMarkerRef.current.setMap(null);
        googleVehicleMarkerRef.current = null;
      }
      if (activeInfoWindowRef.current) {
        activeInfoWindowRef.current.close();
        activeInfoWindowRef.current = null;
      }
    };
  }, []);

  // Recenter handler
  const handleRecenter = useCallback(() => {
    setAutoFollow(true);
    if (activeEngine === 'google' && googleMapRef.current) {
      googleMapRef.current.panTo({ lat: latitude, lng: longitude });
      googleMapRef.current.setZoom(16);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.setView([latitude, longitude], 16, { animate: true });
    }
  }, [activeEngine, latitude, longitude]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (activeEngine === 'google' && googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() ?? 15) + 1);
    } else {
      leafletMapRef.current?.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (activeEngine === 'google' && googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() ?? 15) - 1);
    } else {
      leafletMapRef.current?.zoomOut();
    }
  };

  const handleEnginePillClick = () => {
    if (onEngineToggle) {
      onEngineToggle(activeEngine === 'google' ? 'leaflet' : 'google');
    } else if (onOpenSettings) {
      onOpenSettings();
    }
  };

  return (
    <div className={`map-view-wrapper ${isCockpitMode ? 'cockpit-fullscreen' : ''}`} style={{ height }}>
      {/* 1. Leaflet Container */}
      <div
        ref={leafletContainerRef}
        className="leaflet-map-element"
        style={{
          width: '100%',
          height: '100%',
          display: activeEngine === 'leaflet' ? 'block' : 'none'
        }}
      />

      {/* 2. Google Maps Container */}
      <div
        ref={googleContainerRef}
        className="google-map-element"
        style={{
          width: '100%',
          height: '100%',
          display: activeEngine === 'google' ? 'block' : 'none'
        }}
      />

      {/* Engine Status Pill */}
      <div
        className="map-engine-indicator-pill"
        onClick={handleEnginePillClick}
        title={`Click to configure or toggle map engine (Current: ${
          activeEngine === 'google'
            ? 'Google Maps Platform'
            : mapTilerKey
            ? 'MapTiler Cloud HD'
            : 'Leaflet OpenStreetMap'
        })`}
      >
        <span className={`engine-dot-pulse ${activeEngine === 'google' ? 'google' : mapTilerKey ? 'google' : 'leaflet'}`}></span>
        <span>
          {activeEngine === 'google' ? 'Google Maps JS' : mapTilerKey ? 'MapTiler Cloud HD' : 'Leaflet (OpenStreetMap)'}
        </span>
      </div>

      {/* Floating Controls */}
      <div className="map-overlay-controls">
        {/* Layer Switcher */}
        <div className="map-control-group">
          <button
            type="button"
            className="map-ctrl-btn layer-btn"
            title="Switch Map Theme"
            onClick={() => {
              setActiveTheme((prev) => 
                prev === 'cockpit_dark' ? 'google_streets' : 
                prev === 'google_streets' ? 'satellite_hybrid' : 'cockpit_dark'
              );
            }}
          >
            <Layers size={18} />
            <span className="ctrl-label">{tileProviders[activeTheme].name.split(' ')[0]}</span>
          </button>
        </div>

        {/* Navigation & Zoom Tools */}
        <div className="map-control-group">
          <button
            type="button"
            className={`map-ctrl-btn ${autoFollow ? 'active-follow' : ''}`}
            title="Recenter on Vehicle"
            onClick={handleRecenter}
          >
            <Navigation size={18} className={autoFollow ? 'text-cyan-400' : ''} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            title="Zoom In"
            onClick={handleZoomIn}
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            className="map-ctrl-btn"
            title="Zoom Out"
            onClick={handleZoomOut}
          >
            <ZoomOut size={18} />
          </button>
        </div>
      </div>

      {/* Road Indicator Pill on Bottom Left */}
      <div className="map-road-indicator">
        <div className="road-indicator-content">
          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <span className="road-dot"></span>
            <span>Live Route Tracking</span>
          </div>
          <div className="road-name-text">
            San Francisco Emergency Corridor
          </div>
        </div>
      </div>
    </div>
  );
};
