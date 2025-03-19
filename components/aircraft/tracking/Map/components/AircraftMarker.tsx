// AircraftMarker.tsx
import React, { useEffect } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Aircraft } from '@/types/base';

interface EnhancedAircraftMarkerProps {
  aircraft: Aircraft & {
    type: string;
    isGovernment: boolean;
  };
}

export const EnhancedAircraftMarker: React.FC<EnhancedAircraftMarkerProps> = ({
  aircraft,
}) => {
  const map = useMap();

  useEffect(() => {
    return () => {
      // Cleanup when marker is removed
      console.log('[Marker] Cleaning up marker for:', aircraft.icao24);
    };
  }, [aircraft.icao24]);

  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  const rotationStyle =
    aircraft.type !== 'helicopter'
      ? `transform: rotate(${aircraft.heading || 0}deg); transition: transform 0.3s ease;`
      : '';

  const icon = L.divIcon({
    className: `custom-aircraft-marker-${aircraft.icao24}`,
    html: `
      <div style="width: 32px; height: 32px; ${rotationStyle}">
        <img 
          src="/icons/aircraft-jet.png" 
          width="32" 
          height="32" 
          alt="Aircraft"
          style="width: 100%; height: 100%;"
        />
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const formatHeading = (heading: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((heading % 360) / 45) % 8;
    return `${Math.round(heading)}° ${directions[index]}`;
  };
};

export default React.memo(EnhancedAircraftMarker);
