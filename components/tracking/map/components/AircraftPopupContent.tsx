// components/tracking/map/components/AircraftPopupContent.tsx
import React, { useState } from 'react';
import type { ExtendedAircraft, Aircraft } from '@/types/base';

interface AircraftPopupContentProps {
  aircraft: ExtendedAircraft;
  onSelectAircraft: (icao24: string) => void;
  onClose: () => void;
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
    '3': 'Corporation',
    '4': 'Co-Owned',
    '5': 'Government',
    '7': 'LLC',
    '8': 'Non-Citizen Corporation',
    '9': 'Non-Citizen Co-Owned',
  };
  return ownerTypes[ownerType] || `Type ${ownerType}`;
};

const AircraftPopupContent: React.FC<AircraftPopupContentProps> = ({
  aircraft,
  onSelectAircraft,
  onClose,
}) => {
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Format data
  const registration =
    aircraft.registration || aircraft.N_NUMBER || aircraft.ICAO24;
  const formattedAltitude = aircraft.altitude
    ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';
  const formattedSpeed = aircraft.velocity
    ? Math.round(aircraft.velocity) + ' kts'
    : 'N/A';

  // Get city and state (check both uppercase and lowercase properties)
  const city = aircraft.CITY || aircraft.CITY || '';
  const state = aircraft.STATE || aircraft.STATE || '';
  const hasLocation = city || state;

  // Get aircraft type and styling classes - using local functions
  const aircraftType = determineAircraftType(aircraft);
  const ownerTypeClass = getOwnerTypeClass(aircraft);
  const readableType = getReadableAircraftType(aircraft);
  const ownerType = aircraft.OWNER_TYPE
    ? getOwnerTypeLabel(aircraft.OWNER_TYPE)
    : 'Unknown';

  return (
    <div
      className={`aircraft-popup p-3 ${aircraftType}-popup ${ownerTypeClass}`}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">{registration}</h3>
        <div className="flex items-center">
          <div className={`aircraft-type-badge ${aircraftType}-badge mr-2`}>
            {readableType}
          </div>
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
      </div>

      {/* Always visible summary information */}
      <div className="aircraft-summary grid grid-cols-2 gap-y-2 text-sm">
        <div className="text-gray-600">Model:</div>
        <div className="font-medium">
          {aircraft.MODEL || aircraft.AIRCRAFT_TYPE || 'Unknown'}
        </div>

        <div className="text-gray-600">Altitude:</div>
        <div className="font-medium">{formattedAltitude}</div>

        <div className="text-gray-600">Speed:</div>
        <div className="font-medium">{formattedSpeed}</div>

        {aircraft.on_ground !== undefined && (
          <>
            <div className="text-gray-600">Status:</div>
            <div>
              {aircraft.on_ground ? (
                <span className="status-badge on-ground">On Ground</span>
              ) : (
                <span className="status-badge in-flight">In Flight</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Collapsible detailed information */}
      {detailsVisible && (
        <div className="aircraft-details">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            {aircraft.MANUFACTURER && (
              <>
                <div className="text-gray-600">Manufacturer:</div>
                <div className="font-medium">{aircraft.MANUFACTURER}</div>
              </>
            )}

            {aircraft.heading && (
              <>
                <div className="text-gray-600">Heading:</div>
                <div className="font-medium">
                  {Math.round(aircraft.heading)}°
                </div>
              </>
            )}

            {aircraft.NAME && (
              <>
                <div className="text-gray-600">Name:</div>
                <div className="font-medium">{aircraft.NAME}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AircraftPopupContent;
