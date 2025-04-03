// components/tracking/map/components/AircraftTooltipContent.tsx
import React from 'react';
import {
  getOwnerTypeClass,
  determineAircraftType,
  getReadableAircraftType,
  getOwnerTypeLabel,
} from '../AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';

interface AircraftTooltipContentProps {
  aircraft: ExtendedAircraft;
  zoomLevel: number;
}

const AircraftTooltipContent: React.FC<AircraftTooltipContentProps> = ({
  aircraft,
  zoomLevel,
}) => {
  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft.N_NUMBER || aircraft.ICAO24;

  // Format altitude with commas for thousands
  const formattedAltitude = aircraft.altitude
    ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';

  // Format speed
  const formattedSpeed = aircraft.velocity
    ? Math.round(aircraft.velocity) + ' kts'
    : 'N/A';

  // Heading (if available)
  const heading = aircraft.heading ? Math.round(aircraft.heading) + '°' : 'N/A';

  // Get aircraft type and owner type classes for styling
  const aircraftType = determineAircraftType(aircraft);
  const ownerTypeClass = getOwnerTypeClass(aircraft);
  const readableType = getReadableAircraftType(aircraft);

  return (
    <div className={`aircraft-tooltip-wrapper ${ownerTypeClass}`}>
      <div className={`aircraft-tooltip-header ${aircraftType}-type`}>
        <div className="aircraft-callsign">{registration}</div>
        <div className="aircraft-MODEL">
          {aircraft.MODEL || aircraft.AIRCRAFT_TYPE || readableType}
        </div>
      </div>
      <div className="aircraft-tooltip-content">
        <div className="aircraft-data-grid">
          <div>
            <span className="data-label">Alt:</span>
            <span className="data-value">{formattedAltitude}</span>
          </div>
          <div>
            <span className="data-label">Heading:</span>
            <span className="data-value">{heading}</span>
          </div>
          <div>
            <span className="data-label">Speed:</span>
            <span className="data-value">{formattedSpeed}</span>
          </div>

          {aircraft.on_ground !== undefined && (
            <div>
              <span className="data-label">Status:</span>
              <span
                className={`data-value ${aircraft.on_ground ? 'on-ground-status' : 'in-flight-status'}`}
              >
                {aircraft.on_ground ? 'Ground' : 'Flight'}
              </span>
            </div>
          )}

          {zoomLevel >= 10 && aircraft.MANUFACTURER && (
            <div className="aircraft-data-full">
              <span className="data-label">Mfr:</span>
              <span className="data-value">{aircraft.MANUFACTURER}</span>
            </div>
          )}

          {zoomLevel >= 10 && aircraft.OWNER_TYPE && (
            <div className="aircraft-data-full">
              <span className="data-label">Owner:</span>
              <span
                className={`data-value owner-type-indicator ${ownerTypeClass}`}
              >
                {getOwnerTypeLabel(aircraft.OWNER_TYPE)}
              </span>
            </div>
          )}
        </div>

        {aircraft.lastSeen && (
          <div className="text-xs text-gray-400 mt-2">
            Updated: {new Date(aircraft.lastSeen).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AircraftTooltipContent;
