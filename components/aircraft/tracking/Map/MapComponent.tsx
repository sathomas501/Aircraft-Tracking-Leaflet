import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { EnhancedAircraftMarker } from './components/AircraftMarker';
import type { Aircraft } from '@/types/base';
import { MAP_CONFIG } from '../../../../constants/map';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  aircraft: Aircraft[];
}

// ----------------------------
// Recenter Map Component
// ----------------------------
const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

// ----------------------------
// Marker Manager Component
// ----------------------------
const MarkerManager: React.FC<{ aircraft: Aircraft[] }> = ({ aircraft }) => {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    const newIcao24s = new Set(aircraft.map(ac => ac.icao24));

    // Remove outdated markers
    markersRef.current.forEach((marker, icao24) => {
      if (!newIcao24s.has(icao24)) {
        map.removeLayer(marker);
        markersRef.current.delete(icao24);
      }
    });

    return () => {
      markersRef.current.forEach(marker => map.removeLayer(marker));
      markersRef.current.clear();
    };
  }, [map, aircraft]);

  return null;
};

// ----------------------------
// Helper Function
// ----------------------------
const getAircraftType = (aircraft: Aircraft): string => {
  switch (aircraft.TYPE_AIRCRAFT) {
    case '2': case '3': case '4': case '8':
      return 'jet';
    case '6':
      return 'helicopter';
    default:
      return 'default';
  }
};

// ----------------------------
// Main Map Component
// ----------------------------
const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(MAP_CONFIG.CENTER);

  // Calculate map center dynamically based on aircraft positions
  useEffect(() => {
    if (aircraft.length > 0) {
      const latitudes = aircraft.map(ac => ac.latitude);
      const longitudes = aircraft.map(ac => ac.longitude);

      const avgLat = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;
      const avgLon = longitudes.reduce((sum, lon) => sum + lon, 0) / longitudes.length;

      setMapCenter([avgLat, avgLon]);
    }
  }, [aircraft]);

  // Memoize enhanced aircraft data to optimize rendering
  const enhancedAircraft = useMemo(() => (
    aircraft
      .filter(ac => ac.latitude && ac.longitude)
      .map(ac => ({
        ...ac,
        type: getAircraftType(ac),
        isGovernment: ac.OWNER_TYPE === '5',
      }))
  ), [aircraft]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
      <MapContainer
  center={mapCenter}
  zoom={MAP_CONFIG.DEFAULT_ZOOM}
  style={{ height: '100%', width: '100%' }}
  minZoom={MAP_CONFIG.OPTIONS.minZoom}
  maxBounds={MAP_CONFIG.US_BOUNDS}
  scrollWheelZoom={true}
  dragging={true}
  doubleClickZoom={true}
  touchZoom={true}
  boxZoom={true}
  keyboard={true}
  inertia={true}
  preferCanvas={false}  // Test with this to avoid rendering issues
  whenReady={() => console.log('Map is ready')}
>
        <RecenterMap center={mapCenter} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MarkerManager aircraft={aircraft} />

        {enhancedAircraft.map(ac => (
          <EnhancedAircraftMarker 
            key={`${ac.icao24}-${ac.last_contact}-${ac.heading}`}
            aircraft={ac}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default React.memo(MapComponent);
