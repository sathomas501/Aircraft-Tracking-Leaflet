// components/aircraft/tracking/Map/LeafletMap/components/AircraftMarker.tsx
import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AircraftDisplay } from '@/components/aircraft/AircraftDisplay';
import type { PositionData } from '@/types/types';
import { mapPositionDataToAircraft } from '@/utils/adapters';

interface AircraftMarkerProps {
  id: string;
  position: PositionData;
}

export const AircraftMarker: React.FC<AircraftMarkerProps> = ({ id, position }) => {
  if (!position.latitude || !position.longitude) return null;

  const aircraftData = mapPositionDataToAircraft(position);

  return (
    <Marker
      key={id}
      position={[position.latitude, position.longitude]}
      icon={L.divIcon({
        className: 'aircraft-marker',
        html: `
          <div class="aircraft-icon">
            <img 
              src="${position.on_ground ? '/aircraft-pin.png' : '/aircraft-pin-blue.png'}"
              style="transform: rotate(${position.heading || 0}deg)"
              alt="Aircraft marker"
            />
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })}
    >
      <Popup>
        <div className="min-w-[200px]">
          <AircraftDisplay aircraft={aircraftData} displayMode="popup" />
        </div>
      </Popup>
    </Marker>
  );
};