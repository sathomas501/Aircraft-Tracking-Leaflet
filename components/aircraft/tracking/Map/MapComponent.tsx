import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { EnhancedAircraftMarker } from './components/AircraftMarker';
import type { Aircraft } from '@/types/base';
import { MAP_CONFIG } from './constants';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  aircraft: Aircraft[];
}

// Helper function to determine aircraft type
const getAircraftType = (aircraft: Aircraft): string => {
  switch (aircraft.TYPE_AIRCRAFT) {
    case '2': // Fixed Wing Multi Engine
    case '3': // Jet Aircraft
    case '4': // Turbo Prop
    case '8': // Military
      return 'jet';
    case '6': // Helicopter
      return 'helicopter';
    default:
      return 'default';
  }
};

const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  console.log('MapComponent received aircraft:', aircraft.length);

  // Transform aircraft data
  const enhancedAircraft = aircraft
    .filter(ac => ac.latitude && ac.longitude)
    .map(ac => ({
      ...ac,
      type: getAircraftType(ac),
      isGovernment: ac.OWNER_TYPE === '5'
    }));

  return (
    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        minZoom={MAP_CONFIG.MIN_ZOOM}
        maxBounds={MAP_CONFIG.US_BOUNDS}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {enhancedAircraft.map((ac) => (
          <EnhancedAircraftMarker 
            key={ac.icao24} 
            aircraft={ac}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;