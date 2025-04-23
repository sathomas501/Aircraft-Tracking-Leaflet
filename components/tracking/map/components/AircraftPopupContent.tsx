// components/tracking/map/components/AircraftPopupContent.tsx
import React, { useState } from 'react';
import type { ExtendedAircraft, Aircraft } from '@/types/base';
import { getFlagImageUrl } from '../../../../utils/getFlagImage'; // Adjust the import path as necessary
interface AircraftPopupContentProps {
  aircraft: ExtendedAircraft;
  onSelectAircraft: (icao24: string) => void;
  onClose: () => void;
  inPanel?: boolean; // New prop to indicate if content is in a panel
}

// Include utility functions directly in this file to avoid import issues
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
  const ownerType = aircraft.TYPE_REGISTRANT || aircraft.ownerType || 0;

  // If needed, ensure it's treated as a number for backward compatibility
  const ownerTypeNum =
    typeof ownerType === 'string' ? parseInt(ownerType, 10) : ownerType;

  // Rest of the function using ownerTypeNum
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
  return ownerType
    ? ownerTypeMap[ownerType] || 'unknown-owner'
    : 'unknown-owner';
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
const getOwnerTypeLabel = (ownerType: number | string): string => {
  // Handle undefined/null cases
  if (ownerType === undefined || ownerType === null) return 'Unknown';

  // Skip parsing if it's literally "ownerType"
  if (ownerType === 'ownerType') return 'Unknown';

  // Convert to number if it's a string (safely)
  let ownerTypeNum;
  if (typeof ownerType === 'string') {
    if (/^\d+$/.test(ownerType)) {
      ownerTypeNum = parseInt(ownerType, 10);
    } else {
      return 'Unknown'; // Not a valid number string
    }
  } else {
    ownerTypeNum = ownerType;
  }

  const ownerTypes: Record<number, string> = {
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
  return ownerTypes[ownerTypeNum] || `Type ${ownerType}`;
};

const AircraftPopupContent: React.FC<AircraftPopupContentProps> = ({
  aircraft,
  onSelectAircraft,
  onClose,
  inPanel = false, // Default to false
}) => {
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Format data
  const registration =
    aircraft.REGISTRATION || aircraft.registration || aircraft.N_NUMBER;

  const formattedAltitude = aircraft.altitude
    ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';
  const formattedSpeed = aircraft.velocity
    ? Math.round(aircraft.velocity) + ' kts'
    : 'N/A';

  // Get aircraft type and styling classes
  const aircraftType = determineAircraftType(aircraft);
  const ownerTypeClass = getOwnerTypeClass(aircraft);
  const readableType = getReadableAircraftType(aircraft);
  const ownerTypeValue = aircraft.TYPE_REGISTRANT || aircraft.ownerType;
  console.log('Owner type value:', ownerTypeValue, typeof ownerTypeValue);
  const flagUrl = getFlagImageUrl(aircraft.COUNTRY || '');

  // Ensure it's always passed as a number to getOwnerTypeLabel
  // Don't parse if it's not a valid number string
  let ownerTypeNum;
  if (typeof ownerTypeValue === 'string') {
    // Check if it's a valid number string
    if (/^\d+$/.test(ownerTypeValue)) {
      ownerTypeNum = parseInt(ownerTypeValue, 10);
    } else {
      // Not a valid number - use a default code or the string itself
      ownerTypeNum = 0; // Or another default value
    }
  } else {
    ownerTypeNum = ownerTypeValue || 0;
  }

  return (
    <div className={`aircraft-tooltip-wrapper ${ownerTypeClass}`}>
      {/* Only show the header if not in a panel */}
      {!inPanel && (
        <div className={`aircraft-tooltip-header ${aircraftType}-type`}>
          <div className="aircraft-callsign">
            {aircraft.NAME || aircraft.OPERATOR}
          </div>
          {(aircraft.NAME || aircraft.OPERATOR) && (
            <div className="aircraft-registration">{registration}</div>
          )}
        </div>
      )}

      <div className="aircraft-tooltip-content p-2">
        {/* Controls - only show if not in panel, since panel has its own controls */}
        {!inPanel && (
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <button
                className={`toggle-details-btn flex items-center ${detailsVisible ? 'expanded' : ''}`}
                onClick={() => setDetailsVisible(!detailsVisible)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span className="text-xs font-medium">
                  {detailsVisible ? 'Hide Details' : 'Show Details'}
                </span>
              </button>

              {/* Country flag/identifier next to the button */}
              {flagUrl && (
                <img
                  src={flagUrl}
                  alt={`${aircraft.COUNTRY} flag`}
                  className="w-4 h-3 rounded-sm"
                />
              )}
              <span className="font-bold">{aircraft.COUNTRY}</span>
            </div>

            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
        {/* In panel mode, add details toggle button with country */}
        {inPanel && (
          <div className="flex justify-center items-center mb-2 space-x-2">
            <button
              className={`toggle-details-btn bg-blue-500 hover:bg-blue-600 text-white rounded px-2 py-1 flex items-center`}
              onClick={() => setDetailsVisible(!detailsVisible)}
              title={
                detailsVisible
                  ? 'Hide aircraft details'
                  : 'Show aircraft details'
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transform transition-transform ${detailsVisible ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {/* Country flag/identifier in panel mode */}

            {aircraft.COUNTRY && (
              <span className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-xs font-medium rounded">
                {getFlagImageUrl(aircraft.COUNTRY) && (
                  <img
                    src={getFlagImageUrl(aircraft.COUNTRY) || undefined}
                    alt={`${aircraft.COUNTRY} flag`}
                    className="w-4 h-3 rounded-sm"
                  />
                )}
                {aircraft.COUNTRY}
              </span>
            )}
          </div>
        )}
        {inPanel && (aircraft.NAME || aircraft.OPERATOR) && (
          <div className="text-center text-sm text-gray-600 mb-2">
            {registration}
          </div>
        )}

        {inPanel && aircraft.NAME && (
          <div className="aircraft-data-full mb-2">
            <span className="data-label">Name:</span>
            <span className="data-value">{aircraft.NAME}</span>
          </div>
        )}
        {/* Aircraft data in a compact grid layout */}
        <div className="aircraft-data-grid">
          {/* Manufacturer if available */}
          {aircraft.MANUFACTURER && (
            <div className="aircraft-data-full">
              <span className="data-label">Mfr:</span>
              <span className="data-value">{aircraft.MANUFACTURER}</span>
            </div>
          )}

          {/* Always show model */}
          <div className="aircraft-data-full">
            <span className="data-label">Model:</span>
            <span className="data-value">
              {aircraft.MODEL || aircraft.TYPE_AIRCRAFT || readableType}
            </span>
          </div>

          {/* Owner type if available */}
          {(aircraft.TYPE_REGISTRANT || aircraft.ownerType) && (
            <div className="aircraft-data-full">
              <span className="data-label">Owner:</span>
              <span
                className={`data-value owner-type-indicator ${ownerTypeClass}`}
              >
                {getOwnerTypeLabel(ownerTypeNum)}
              </span>
            </div>
          )}

          {/* Removed Country field since it's now shown near the Show/Hide Details button */}

          <div>
            <span className="data-label">Alt:</span>
            <span className="data-value">{formattedAltitude}</span>
          </div>

          <div>
            <span className="data-label">Spd:</span>
            <span className="data-value">{formattedSpeed}</span>
          </div>

          {aircraft.heading && (
            <div>
              <span className="data-label">Hdg:</span>
              <span className="data-value">
                {Math.round(aircraft.heading)}°
              </span>
            </div>
          )}

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
        {/* Collapsible detailed information */}
        {detailsVisible && (
          <div className="aircraft-details mt-3 pt-3 border-t border-gray-200">
            <div className="aircraft-data-grid">
              {aircraft.ICAO24 && (
                <div className="aircraft-data-full">
                  <span className="data-label">ICAO24:</span>
                  <span className="data-value">{aircraft.ICAO24}</span>
                </div>
              )}
              {aircraft.CITY && aircraft.STATE && (
                <div className="aircraft-data-full">
                  <span className="data-label">Location:</span>
                  <span className="data-value">
                    {aircraft.CITY}, {aircraft.STATE}
                  </span>
                </div>
              )}
              {aircraft.lastSeen && (
                <div className="aircraft-data-full">
                  <span className="data-label">Updated:</span>
                  <span className="data-value">
                    {new Date(aircraft.lastSeen).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AircraftPopupContent;
