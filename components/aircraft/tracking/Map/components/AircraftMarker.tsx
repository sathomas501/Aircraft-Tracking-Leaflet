// AircraftMarker.tsx
import React, { useEffect } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Aircraft } from '@/types/base';
import AircraftTrail from '../components/AircraftIcon/AircraftTrail';

interface EnhancedAircraftMarkerProps {
  aircraft: Aircraft & {
    type: string;
    isGovernment: boolean;
  };
}

export const EnhancedAircraftMarker: React.FC<EnhancedAircraftMarkerProps> = ({ aircraft }) => {
  const map = useMap();

  useEffect(() => {
    return () => {
      // Cleanup when marker is removed
      console.log('[Marker] Cleaning up marker for:', aircraft.icao24);
    };
  }, [aircraft.icao24]);

  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  const rotationStyle = aircraft.type !== 'helicopter'
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
    const index = Math.round(((heading % 360) / 45)) % 8;
    return `${Math.round(heading)}° ${directions[index]}`;
  };

  return (
    <>
      <AircraftTrail icao24={aircraft.icao24} />
      <Marker
        position={[aircraft.latitude, aircraft.longitude]}
        icon={icon}
        key={`${aircraft.icao24}-${aircraft.last_contact}`}
      >
        <Tooltip>
          <div className="min-w-[150px]">
            <div className="font-bold">{aircraft['N-NUMBER']}</div>
            <div>{aircraft.model}</div>
            {aircraft.heading && (
              <div>Heading: {formatHeading(aircraft.heading)}</div>
            )}
            {aircraft.altitude && (
              <div>Alt: {Math.round(aircraft.altitude).toLocaleString()} ft</div>
            )}
            {aircraft.velocity && (
              <div>Speed: {Math.round(aircraft.velocity)} kts</div>
            )}
          </div>
        </Tooltip>

        <Popup>
          <div className="min-w-[200px]">
            <h3 className="font-bold text-lg mb-2">{aircraft['N-NUMBER']}</h3>
            <div className="space-y-1">
              {aircraft.model && (
                <div><span className="font-semibold">Model:</span> {aircraft.model}</div>
              )}
              {aircraft.heading && (
                <div><span className="font-semibold">Heading:</span> {formatHeading(aircraft.heading)}</div>
              )}
              {aircraft.altitude && (
                <div><span className="font-semibold">Altitude:</span> {Math.round(aircraft.altitude).toLocaleString()} ft</div>
              )}
              {aircraft.velocity && (
                <div><span className="font-semibold">Speed:</span> {Math.round(aircraft.velocity)} kts</div>
              )}
              {aircraft.NAME && (
                <div><span className="font-semibold">Owner:</span> {aircraft.NAME}</div>
              )}
              {(aircraft.CITY || aircraft.STATE) && (
                <div><span className="font-semibold">Location:</span> {[aircraft.CITY, aircraft.STATE].filter(Boolean).join(', ')}</div>
              )}
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
};

export default React.memo(EnhancedAircraftMarker);