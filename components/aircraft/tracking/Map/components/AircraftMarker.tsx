// AircraftMarker.tsx
import React, { useEffect } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Aircraft } from '@/types/base';
import { createAircraftIcon } from '../../Map/components/AircraftIcon/AircraftIcon';

interface EnhancedAircraftMarkerProps {
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
  };
  isSelected?: boolean;
  onClick?: (aircraft: Aircraft) => void;
}

export const EnhancedAircraftMarker: React.FC<EnhancedAircraftMarkerProps> = ({
  aircraft,
  isSelected = false,
  onClick,
}) => {
  const map = useMap();

  useEffect(() => {
    return () => {
      // Cleanup when marker is removed
      console.log('[Marker] Cleaning up marker for:', aircraft.icao24);
    };
  }, [aircraft.icao24]);

  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  // Create the icon using the existing function
  const icon = createAircraftIcon(aircraft, { isSelected });

  // Format altitude with commas for thousands
  const formattedAltitude = aircraft.altitude
    ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';

  // Format speed
  const formattedSpeed = aircraft.velocity
    ? Math.round(aircraft.velocity) + ' kts'
    : 'N/A';

  // Format heading with direction
  const formatHeading = (heading: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((heading % 360) / 45) % 8;
    return `${Math.round(heading)}° ${directions[index]}`;
  };

  const handleClick = () => {
    if (onClick) {
      onClick(aircraft);
    }
  };

  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

  return (
    <Marker
      position={[aircraft.latitude, aircraft.longitude]}
      icon={icon}
      eventHandlers={{
        click: handleClick,
      }}
      zIndexOffset={isSelected ? 1000 : 0}
    >
      {/* Enhanced tooltip with DB data */}
      <Tooltip
        direction="top"
        offset={[0, -20]}
        opacity={0.9}
        className="aircraft-tooltip"
      >
        <div className="p-1">
          <div className="text-xs">
            {aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}
          </div>
          <div className="grid grid-cols-2 gap-x-2 text-xs mt-1">
            <div>Alt: {formattedAltitude}</div>
            <div>Speed: {formattedSpeed}</div>
            {aircraft.heading && (
              <div className="col-span-2">
                Heading: {formatHeading(aircraft.heading)}
              </div>
            )}
            {aircraft.manufacturer && (
              <div className="col-span-2">{aircraft.manufacturer}</div>
            )}
          </div>
        </div>
      </Tooltip>

      {/* Detailed popup when clicked */}
      <Popup className="aircraft-popup">
        <div className="p-1">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="font-medium pr-2">Model:</td>
                <td>{aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Manufacturer:</td>
                <td>{aircraft.manufacturer || 'Unknown'}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Altitude:</td>
                <td>{formattedAltitude}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Speed:</td>
                <td>{formattedSpeed}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Heading:</td>
                <td>
                  {aircraft.heading
                    ? formatHeading(aircraft.heading)
                    : 'Unknown'}
                </td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Registration:</td>
                <td>{registration}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">ICAO:</td>
                <td>{aircraft.icao24}</td>
              </tr>
              {aircraft.owner && (
                <tr>
                  <td className="font-medium pr-2">Owner:</td>
                  <td>{aircraft.owner}</td>
                </tr>
              )}
              {(aircraft.CITY || aircraft.STATE) && (
                <tr>
                  <td className="font-medium pr-2">Location:</td>
                  <td>
                    {[aircraft.CITY, aircraft.STATE].filter(Boolean).join(', ')}
                  </td>
                </tr>
              )}
              {aircraft.TYPE_AIRCRAFT && (
                <tr>
                  <td className="font-medium pr-2">Type:</td>
                  <td>{aircraft.TYPE_AIRCRAFT}</td>
                </tr>
              )}
              {aircraft.OWNER_TYPE && (
                <tr>
                  <td className="font-medium pr-2">Owner Type:</td>
                  <td>{getOwnerTypeLabel(aircraft.OWNER_TYPE)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Popup>
    </Marker>
  );
};

// Helper function to convert owner type codes to readable labels
function getOwnerTypeLabel(ownerType: string): string {
  const ownerTypes: Record<string, string> = {
    '1': 'Individual',
    '2': 'Partnership',
    '3': 'Corporation',
    '4': 'Co-Owned',
    '5': 'Government',
    '8': 'Non-Citizen Corporation',
    '9': 'Non-Citizen Co-Owned',
  };
  return ownerTypes[ownerType] || `Type ${ownerType}`;
}

export default React.memo(EnhancedAircraftMarker);
