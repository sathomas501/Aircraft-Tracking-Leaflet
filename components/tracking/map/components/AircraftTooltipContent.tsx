// components/tracking/map/components/AircraftTooltipContent.tsx
import React from 'react';
import type { ExtendedAircraft, Aircraft } from '@/types/base';
import { getFlagImageUrl } from '../../../../utils/getFlagImage'; // Adjust the import path as necessary

interface AircraftTooltipContentProps {
  aircraft: ExtendedAircraft;
  zoomLevel: number;
}

// Include your utility functions directly in this file to avoid import issues
// This is a temporary solution until the import issue is fixed

// Local utility function - determine aircraft type
const determineAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    TYPE_AIRCRAFT?: string;
    MODEL?: string;
  }
): string => {
  // Combine possible type fields for checking
  const typeString = [aircraft.type, aircraft.TYPE_AIRCRAFT, aircraft.MODEL]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Check for balloon (adding support for your aircraft_balloon.png)
  if (typeString.includes('balloon') || typeString.includes('airship')) {
    return 'balloon';
  }

  // Check for different helicopter/rotor types
  if (typeString.includes('helicopter') || typeString.includes('rotor')) {
    return 'helicopter';
  }

  // Check for different jet types
  if (typeString.includes('jet') || typeString.includes('airliner')) {
    return 'jet';
  }

  // Check for turboprop
  if (typeString.includes('turboprop') || typeString.includes('turbo prop')) {
    return 'turboprop';
  }

  // Check for twin engines
  if (typeString.includes('twin')) {
    return 'twinEngine';
  }

  // Check for single engine or piston aircraft
  if (typeString.includes('single') || typeString.includes('piston')) {
    return 'singleEngine';
  }

  // Default to jet for unknown types
  return 'default';
};

// Local utility function - get owner type class
const getOwnerTypeClass = (
  aircraft: Aircraft & {
    TYPE_REGISTRANT?: number;
    isGovernment?: boolean;
  }
): string => {
  const ownerType = aircraft.TYPE_REGISTRANT || aircraft.ownerType || '';

  // Map owner type to CSS class
  const ownerTypeMap: Record<number, string> = {
    1: 'Individual',
    2: 'Partnership',
    3: 'Corp-owner',
    4: 'Co-owned',
    7: 'LLC',
    8: 'non-citizen-corp-owned',
    9: 'Airline',
    10: 'Freight',
    11: 'Medical',
    12: 'Media',
    13: 'Historical',
    14: 'Flying Club',
    15: 'Emergency',
    16: 'Local Govt',
    17: 'Education',
    18: 'Federal Govt',
    19: 'Flight School',
    20: 'Leasing Corp',
    21: 'Military',
  };

  // Default to 'unknown-owner' if type not found
  return ownerTypeMap[Number(ownerType)] || 'unknown-owner';
};

// Local utility function - get readable aircraft type
const getReadableAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    TYPE_AIRCRAFT?: string;
  }
): string => {
  const aircraftType = determineAircraftType(aircraft);

  // Map internal type to readable name
  const typeMap: Record<string, string> = {
    helicopter: 'Helicopter',
    jet: 'Jet Aircraft',
    turboprop: 'Turboprop',
    singleEngine: 'Single Engine',
    twinEngine: 'Twin Engine',
    default: 'Aircraft',
  };

  return typeMap[aircraftType] || 'Aircraft';
};

// Local utility function - get owner type label
const getOwnerTypeLabel = (ownerType: number): string => {
  const ownerTypes: Record<string, string> = {
    1: 'Individual',
    2: 'Partnership',
    3: 'Corp-owner',
    4: 'Co-owned',
    7: 'LLC',
    8: 'non-citizen-corp-owned',
    9: 'Airline',
    10: 'Freight',
    11: 'Medical',
    12: 'Media',
    13: 'Historical',
    14: 'Flying Club',
    15: 'Emergency',
    16: 'Local Govt',
    17: 'Education',
    18: 'Federal Govt',
    19: 'Flight School',
    20: 'Leasing Corp',
    21: 'Military',
  };
  return ownerTypes[ownerType] || `Type ${ownerType}`;
};

const AircraftTooltipContent: React.FC<AircraftTooltipContentProps> = ({
  aircraft,
  zoomLevel,
}) => {
  // Registration or REGISTRATION
  const registration =
    aircraft.REGISTRATION || aircraft.registration || aircraft.ICAO24;

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

  // Get aircraft type and owner type classes for styling - using local functions
  const aircraftType = determineAircraftType(aircraft);
  const ownerTypeClass = getOwnerTypeClass(aircraft);
  const readableType = getReadableAircraftType(aircraft);

  return (
    <div className={`aircraft-tooltip-wrapper ${ownerTypeClass}`}>
      <div className={`aircraft-tooltip-header ${aircraftType}-type`}>
        {/* Show aircraft name if available, otherwise registration */}
        <div className="aircraft-callsign text-center font-bold">
          {aircraft.NAME ? aircraft.NAME : registration}
        </div>
        {/* Show registration separately if NAME is present */}
        {aircraft.NAME && (
          <div className="aircraft-registration text-center">
            {registration}
          </div>
        )}
      </div>
      <div className="aircraft-tooltip-content">
        <div className="aircraft-data-grid">
          {/* Always show manufacturer if available */}
          {aircraft.MANUFACTURER && (
            <div className="aircraft-data-full">
              <span className="data-label">Mfr:</span>
              <span className="data-value">{aircraft.MANUFACTURER}</span>
            </div>
          )}

          {/* Always show model if available */}
          <div className="aircraft-data-full">
            <span className="data-label">Model:</span>
            <span className="data-value">
              {aircraft.MODEL || aircraft.TYPE_AIRCRAFT || readableType}
            </span>
          </div>

          {/* Always show owner type if available */}
          {aircraft.TYPE_REGISTRANT && (
            <div className="aircraft-data-full">
              <span className="data-label">Owner:</span>
              <span
                className={`data-value owner-type-indicator ${ownerTypeClass}`}
              >
                {getOwnerTypeLabel(aircraft.TYPE_REGISTRANT)}
              </span>
            </div>
          )}

          {/* Add country if available */}
          {aircraft.COUNTRY && (
            <div className="aircraft-data-full">
              <span className="data-label">Country:</span>
              <span className="data-value flex items-center gap-2">
                {getFlagImageUrl(aircraft.COUNTRY) && (
                  <img
                    src={getFlagImageUrl(aircraft.COUNTRY) ?? undefined}
                    alt={`${aircraft.COUNTRY} flag`}
                    className="w-5 h-3 rounded-sm"
                  />
                )}
                {aircraft.COUNTRY}
              </span>
            </div>
          )}

          {/* Flight information */}
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

// At the bottom of AircraftTooltipContent.tsx
export default AircraftTooltipContent;
