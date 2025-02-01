import React from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Aircraft } from '@/types/base';

interface EnhancedAircraftMarkerProps {
  aircraft: Aircraft & {
    type: string;
    isGovernment: boolean;
  };
}

const getAircraftIconUrl = (type: string | null | undefined, isGovernment: boolean): string => {
  const baseIconPath = '/icons/';
  
  if (isGovernment) {
    return type === 'helicopter'
      ? `${baseIconPath}aircraft-government-helicopter.png`
      : `${baseIconPath}aircraft-government.png`;
  }

  // Default to 'jet' if type is null, undefined, or unrecognized
  switch (type) {
    case 'prop': return `${baseIconPath}aircraft-prop.png`;
    case 'helicopter': return `${baseIconPath}aircraft-helicopter.png`;
    case 'jet': return `${baseIconPath}aircraft-jet.png`;
    default: return `${baseIconPath}aircraft-jet.png`;  // Default to jet
  }
};

const isValidField = (value: any) => value !== undefined && value !== null && value !== 'Unknown';

export const EnhancedAircraftMarker: React.FC<EnhancedAircraftMarkerProps> = ({ aircraft }) => {
  if (!isValidField(aircraft.latitude) || !isValidField(aircraft.longitude)) return null;

  const iconUrl = getAircraftIconUrl(aircraft.type, aircraft.isGovernment || false);
  const heading = aircraft.heading || 0;

  const rotatedIcon = L.divIcon({
    className: 'custom-aircraft-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        transform: rotate(${heading}deg);
        transition: transform 0.3s ease;
      ">
        <img 
          src="${iconUrl}"
          width="32"
          height="32"
          style="width: 100%; height: 100%;"
          alt="Aircraft"
        />
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

  return (
    <Marker
      position={[aircraft.latitude, aircraft.longitude]}
      icon={rotatedIcon}
      zIndexOffset={aircraft.type === 'helicopter' ? 1000 : 0}
    >
      <Tooltip direction="top" offset={[0, -16]} opacity={1.0}>
        <div>
          <strong>{isValidField(aircraft['N-NUMBER']) ? aircraft['N-NUMBER'] : aircraft.icao24}</strong><br />
          {isValidField(aircraft.operator) && <span>{aircraft.operator}<br /></span>}
          {isValidField(aircraft.NAME) && <span>{aircraft.NAME}<br /></span>}
          {isValidField(aircraft.altitude) && <span>{Math.round(aircraft.altitude)} ft<br /></span>}
          {isValidField(aircraft.velocity) && <span>{Math.round(aircraft.velocity)} kts</span>}
        </div>
      </Tooltip>

      <Popup>
        <div className="min-w-[200px]">
          <h3 className="font-bold mb-2">{isValidField(aircraft['N-NUMBER']) ? aircraft['N-NUMBER'] : aircraft.icao24}</h3>
          {isValidField(aircraft.manufacturer) && <p><strong>Manufacturer:</strong> {aircraft.manufacturer}</p>}
          {isValidField(aircraft.model) && <p><strong>Model:</strong> {aircraft.model}</p>}
          {isValidField(aircraft.NAME) && <p><strong>Owner:</strong> {aircraft.NAME}</p>}
          {isValidField(aircraft.operator) && <p><strong>Operator:</strong> {aircraft.operator}</p>}
          {(isValidField(aircraft.CITY) || isValidField(aircraft.STATE)) && (
            <p><strong>Location:</strong> {[aircraft.CITY, aircraft.STATE].filter(isValidField).join(', ')}</p>
          )}
          {isValidField(aircraft.altitude) && (
            <p><strong>Altitude:</strong> {aircraft.altitude.toLocaleString()} ft</p>
          )}
          {isValidField(aircraft.velocity) && (
            <p><strong>Speed:</strong> {Math.round(aircraft.velocity)} kts</p>
          )}
          {isValidField(aircraft.heading) && (
            <p><strong>Heading:</strong> {Math.round(aircraft.heading)}°</p>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

export default EnhancedAircraftMarker;
