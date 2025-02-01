// DynamicMap.tsx
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { EnhancedAircraftMarker } from './components/AircraftMarker';
import type { Aircraft } from '@/types/base';
import { MAP_CONFIG, TILE_LAYER } from './mapConstants';
import 'leaflet/dist/leaflet.css';

interface DynamicMapProps {
  aircraft: Array<Aircraft & {
    type: string;
    isGovernment: boolean;
  }>;
}

const DynamicMap: React.FC<DynamicMapProps> = ({ aircraft }) => {
  return (
    <MapContainer
      center={MAP_CONFIG.CENTER}
      zoom={MAP_CONFIG.DEFAULT_ZOOM}
      style={{ height: '100%', width: '100%' }}
      minZoom={MAP_CONFIG.MIN_ZOOM}
      maxBounds={MAP_CONFIG.US_BOUNDS}
      scrollWheelZoom={true}
    >
      <TileLayer
        url={TILE_LAYER.URL}
        attribution={TILE_LAYER.ATTRIBUTION}
      />

      {aircraft.map((ac) => (
        <EnhancedAircraftMarker 
          key={ac.icao24} 
          aircraft={ac}
        />
      ))}
    </MapContainer>
  );
};

export default DynamicMap;