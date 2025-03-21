// components/tracking/map/components/EnhancedContextAircraftMarker.tsx
import React from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { createAircraftIcon } from '../../aircraft/tracking/Map/components/AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';

interface EnhancedContextAircraftMarkerProps {
  aircraft: ExtendedAircraft;
}

const EnhancedContextAircraftMarker: React.FC<
  EnhancedContextAircraftMarkerProps
> = ({ aircraft }) => {
  const { selectedAircraft, selectAircraft, zoomLevel } =
    useEnhancedMapContext();
  const isSelected = selectedAircraft?.icao24 === aircraft.icao24;

  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  // Create the icon using the responsive function with current zoom level
  const icon = createAircraftIcon(aircraft, {
    isSelected,
    zoomLevel: zoomLevel || 9,
  });

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

  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

  const iconToUse = icon || undefined; // Convert null to undefined if needed

  return (
    <Marker
      position={[aircraft.latitude, aircraft.longitude]}
      icon={iconToUse}
      eventHandlers={{
        click: () => selectAircraft(aircraft),
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
            </tbody>
          </table>
        </div>
      </Popup>
    </Marker>
  );
};

export default React.memo(EnhancedContextAircraftMarker);
