// components/tracking/map/components/AircraftPopupContent.tsx
import React, { useState } from 'react';
import type { ExtendedAircraft, Aircraft } from '@/types/base';

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
    AIRCRAFT_TYPE?: string;
    MODEL?: string;
  }
): string => {
  // Combine possible type fields for checking
  const typeString = [aircraft.type, aircraft.AIRCRAFT_TYPE, aircraft.MODEL]
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
    OWNER_TYPE?: string;
    isGovernment?: boolean;
  }
): string => {
  const ownerType = aircraft.OWNER_TYPE || '';

  // Map owner type to CSS class
  const ownerTypeMap: Record<string, string> = {
    '1': 'Individual',
    '2': 'Partnership',
    '3': 'Corp-owner',
    '4': 'Co-owned',
    '7': 'LLC',
    '8': 'non-citizen-corp-owned',
    '9': 'Airline',
    '10': 'Freight',
    '11': 'Medical',
    '12': 'Media',
    '13': 'Historical',
    '14': 'Flying Club',
    '15': 'Emergency',
    '16': 'Local Govt',
    '17': 'Education',
    '18': 'Federal Govt',
    '19': 'Flight School',
    '20': 'Leasing Corp',
  };

  // Default to 'unknown-owner' if type not found
  return ownerTypeMap[ownerType] || 'unknown-owner';
};

// Local utility function - get readable aircraft type
const getReadableAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    AIRCRAFT_TYPE?: string;
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
const getOwnerTypeLabel = (ownerType: string): string => {
  const ownerTypes: Record<string, string> = {
    '1': 'Individual',
    '2': 'Partnership',
    '3': 'Corp-owner',
    '4': 'Co-owned',
    '7': 'LLC',
    '8': 'non-citizen-corp-owned',
    '9': 'Airline',
    '10': 'Freight',
    '11': 'Medical',
    '12': 'Media',
    '13': 'Historical',
    '14': 'Flying Club',
    '15': 'Emergency',
    '16': 'Local Govt',
    '17': 'Education',
    '18': 'Federal Govt',
    '19': 'Flight School',
    '20': 'Leasing Corp',
  };
  return ownerTypes[ownerType] || `Type ${ownerType}`;
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
    aircraft.N_NUMBER || aircraft.registration || aircraft.ICAO24;
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
  const ownerType = aircraft.OWNER_TYPE
    ? getOwnerTypeLabel(aircraft.OWNER_TYPE)
    : 'Unknown';

  // Determine if this is an airline aircraft
  const isAirline =
    aircraft.OPERATOR &&
    (aircraft.OPERATOR.toLowerCase().includes('airline') ||
      aircraft.OPERATOR.toLowerCase().includes('airways') ||
      ownerTypeClass === 'Airline');

  return (
    <div className={`aircraft-tooltip-wrapper ${ownerTypeClass}`}>
      {/* Only show the header if not in a panel */}
      {!inPanel && (
        <div className={`aircraft-tooltip-header ${aircraftType}-type`}>
          <div className="aircraft-callsign">
            {aircraft.NAME || (isAirline ? aircraft.OPERATOR : registration)}
          </div>
          {(aircraft.NAME || isAirline) && (
            <div className="aircraft-registration">{registration}</div>
          )}
        </div>
      )}

      <div className="aircraft-tooltip-content p-2">
        {/* Controls - only show if not in panel, since panel has its own controls */}
        {!inPanel && (
          <div className="flex justify-between items-center mb-2">
            <button
              className={`toggle-details-btn ${detailsVisible ? 'expanded' : ''}`}
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
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

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
        {/* In panel mode, add details toggle button */}
        {inPanel && (
          <div className="flex justify-center mb-2">
            <button
              className={`toggle-details-btn ${detailsVisible ? 'expanded' : ''}`}
              onClick={() => setDetailsVisible(!detailsVisible)}
            >
              {detailsVisible ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        )}
        {inPanel && (aircraft.NAME || isAirline) && (
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
              {aircraft.MODEL || aircraft.AIRCRAFT_TYPE || readableType}
            </span>
          </div>

          {/* Owner type if available */}
          {aircraft.OWNER_TYPE && (
            <div className="aircraft-data-full">
              <span className="data-label">Owner:</span>
              <span
                className={`data-value owner-type-indicator ${ownerTypeClass}`}
              >
                {ownerType}
              </span>
            </div>
          )}

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
