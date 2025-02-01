// MapComponent.tsx
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import dynamic from 'next/dynamic';
import { EnhancedAircraftMarker } from './components/AircraftMarker';
import type { Aircraft } from '@/types/base';
import { MAP_CONFIG } from './constants';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  aircraft: Aircraft[];
}

// Helper function to determine aircraft type
const getAircraftType = (aircraft: Aircraft): string => {
  console.log('Processing aircraft:', {
    icao24: aircraft.icao24,
    TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT,
    rawData: aircraft
  });

  // If TYPE_AIRCRAFT is already set to '3' from MapWrapper, use it
  if (aircraft.TYPE_AIRCRAFT === '3') {
    console.log('Using preset type (jet) for:', aircraft.icao24);
    return 'jet';
  }

  switch (aircraft.TYPE_AIRCRAFT) {
    case '2': // Fixed Wing Multi Engine
    case '3': // Jet Aircraft
    case '4': // Turbo Prop
    case '8': // Military
      console.log('Mapped to jet based on type code:', aircraft.TYPE_AIRCRAFT);
      return 'jet';
    case '6': // Helicopter
      return 'helicopter';
    default:
      // If manufacturer is Learjet, force jet type
      if (aircraft.manufacturer?.toLowerCase().includes('learjet')) {
        console.log('Forced jet type based on Learjet manufacturer');
        return 'jet';
      }
      console.log('No mapping found, defaulting to balloon for:', aircraft.icao24);
      return 'balloon';
  }
};

const Map = dynamic(
  () => import('react-leaflet').then((mod) => {
    const { MapContainer } = mod;
    return MapContainer;
  }),
  { ssr: false }
);

const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  console.log('MapComponent received aircraft:', aircraft);

  // Transform aircraft data
  const enhancedAircraft = aircraft
    .filter(ac => ac.latitude !== undefined && ac.longitude !== undefined)
    .map(ac => ({
      ...ac,
      type: getAircraftType(ac),
      isGovernment: ac.OWNER_TYPE === '5'
    }));

  console.log('Enhanced aircraft data:', enhancedAircraft[0]);

  if (typeof window === 'undefined') return null;

  return (
    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
      <Map
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        minZoom={MAP_CONFIG.MIN_ZOOM}
        maxBounds={MAP_CONFIG.US_BOUNDS}
        scrollWheelZoom={true}
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
      </Map>
    </div>
  );
};

export default MapComponent;