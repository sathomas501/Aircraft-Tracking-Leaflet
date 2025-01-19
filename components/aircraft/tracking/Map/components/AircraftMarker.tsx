import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AircraftDisplay } from '@/components/aircraft/AircraftDisplay';
import type { Aircraft } from '@/types/base';

interface AircraftMarkerProps {
  aircraft: Aircraft; // Use Aircraft instead of PositionData
}

export const AircraftMarker: React.FC<AircraftMarkerProps> = ({ aircraft }) => {
  if (!aircraft.latitude || !aircraft.longitude) return null;

  return (
    <Marker
      key={aircraft.icao24}
      position={[aircraft.latitude, aircraft.longitude]}
      icon={L.divIcon({
        className: 'aircraft-marker',
        html: `
          <div class="aircraft-icon">
            <img 
              src="${aircraft.on_ground ? '/aircraft-pin.png' : '/aircraft-pin-blue.png'}"
              style="transform: rotate(${aircraft.heading || 0}deg);"
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
          <AircraftDisplay aircraft={aircraft} displayMode="popup" />
        </div>
      </Popup>
    </Marker>
  );
};

export default AircraftMarker;
