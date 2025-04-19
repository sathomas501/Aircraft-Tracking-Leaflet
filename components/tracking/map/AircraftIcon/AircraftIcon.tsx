// components/tracking/map/AircraftIcon/AircraftIcon.tsx
import type { Aircraft } from '@/types/base';

interface AircraftIconOptions {
  isSelected?: boolean;
  zoomLevel?: number;
}

// Function to calculate icon size based on zoom level
export const getIconSizeForZoom = (
  zoomLevel: number,
  isSelected: boolean = false
): number => {
  // Base size adjustments based on zoom
  let size = 16; // Minimum size

  if (zoomLevel >= 5) size = 20;
  if (zoomLevel >= 7) size = 24;
  if (zoomLevel >= 9) size = 28;
  if (zoomLevel >= 11) size = 32;
  if (zoomLevel >= 13) size = 36;

  // Apply additional size boost for selected aircraft
  if (isSelected) {
    size += 8;
  }

  return size;
};

// Get font size for tooltips based on zoom level
export const getTooltipFontSize = (zoomLevel: number): string => {
  if (zoomLevel >= 11) return '0.875rem'; // 14px
  if (zoomLevel >= 9) return '0.8125rem'; // 13px
  return '0.75rem'; // 12px
};

// determineAircraftType function that prioritizes the database type_aircraft code
// Enhanced determineAircraftType function with support for both FAA and international codes
export const determineAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    TYPE_AIRCRAFT?: string | number;
    MODEL?: string;
    MANUFACTURER?: string;
  }
): string => {
  // Start with type_aircraft code - this is definitive
  if (aircraft.TYPE_AIRCRAFT !== undefined && aircraft.TYPE_AIRCRAFT !== null) {
    // Convert to string for unified handling
    const typeCode = String(aircraft.TYPE_AIRCRAFT).trim();

    console.log('Processing type_aircraft code:', {
      icao: aircraft.ICAO24,
      typeCode: typeCode,
    });

    // Check if it's an international code format (contains letters)
    if (typeCode.match(/[A-Za-z]/)) {
      // It contains letters, likely an international code
      const intlCode = typeCode.toUpperCase();

      // Define mappings for common international aircraft type codes
      const intlCodeMap: Record<string, string> = {
        // Helicopter codes
        H2T: 'helicopter',
        H2P: 'helicopter', // Twin-engine helicopter
        H1P: 'helicopter', // Single-engine helicopter
        H1E: 'helicopter', // Light helicopter
        H2E: 'helicopter', // Heavy helicopter
        H1T: 'helicopter', // Single turbine helicopter

        // Jet aircraft
        L1J: 'jet', // Single-engine jet
        L2J: 'jet', // Twin-engine jet
        L3J: 'jet', // Three-engine jet
        L4J: 'jet', // Four-engine jet

        // Propeller aircraft
        L1P: 'singleEngine', // Single-engine prop
        L2P: 'twinEngine', // Twin-engine prop
        L3P: 'twinEngine', // Three-engine prop
        L4P: 'twinEngine', // Four-engine prop

        // Turboprop aircraft
        L1T: 'turboprop', // Single-engine turboprop
        L2T: 'turboprop', // Twin-engine turboprop
        L3T: 'turboprop', // Three-engine turboprop
        L4T: 'turboprop', // Four-engine turboprop

        // Other types
        GLID: 'glider',
        BALL: 'balloon',
        ULAC: 'weightshift', // Ultra-light aircraft
        GYRO: 'gyroplane',

        // Special single-character codes
        H: 'hybrid',
        O: 'other',
      };

      // Check if we have a mapping for this international code
      if (intlCodeMap[intlCode]) {
        console.log(
          `Aircraft type detected by international code ${intlCode}:`,
          {
            icao: aircraft.ICAO24,
            mappedType: intlCodeMap[intlCode],
          }
        );
        return intlCodeMap[intlCode];
      }

      // If it starts with 'H', it's likely a helicopter
      if (intlCode.startsWith('H')) {
        console.log('Helicopter detected by international code prefix H:', {
          icao: aircraft.ICAO24,
          intlCode: intlCode,
        });
        return 'helicopter';
      }

      // Log unknown international codes for future reference
      console.log('Unknown international type code:', {
        icao: aircraft.ICAO24,
        code: intlCode,
      });
    }
    // Check if it's a numeric FAA type code
    else if (!isNaN(Number(typeCode))) {
      const numericCode = parseInt(typeCode, 10);

      // Map type codes to aircraft types based on the FAA schema
      switch (numericCode) {
        case 1:
          return 'glider';
        case 2:
          return 'balloon';
        case 3:
          return 'blimp';
        case 4:
          return 'singleEngine';
        case 5:
          return 'twinEngine';
        case 6:
          console.log('Helicopter detected by FAA type code 6 (Rotorcraft)!', {
            icao: aircraft.ICAO24,
          });
          return 'helicopter';
        case 7:
          return 'weightshift';
        case 8:
          return 'parachute';
        case 9:
          console.log('Gyroplane detected by FAA type code 9!', {
            icao: aircraft.ICAO24,
          });
          return 'gyroplane';
        default:
          console.log('Unknown numeric type_aircraft code:', {
            icao: aircraft.ICAO24,
            code: numericCode,
          });
      }
    }
  }

  // Fallback detection for Eurocopter based on manufacturer/model
  if (
    aircraft.MANUFACTURER &&
    aircraft.MANUFACTURER.toUpperCase().includes('EUROCOPTER')
  ) {
    console.log('Eurocopter detected by manufacturer!', {
      icao: aircraft.ICAO24,
      manufacturer: aircraft.MANUFACTURER,
    });
    return 'helicopter';
  }

  if (
    aircraft.MODEL &&
    (aircraft.MODEL.toUpperCase().includes('EC 130') ||
      aircraft.MODEL.toUpperCase().includes('EC130') ||
      aircraft.MODEL.toUpperCase().includes('EC 135') ||
      aircraft.MODEL.toUpperCase().includes('EC135'))
  ) {
    console.log('Eurocopter detected by model!', {
      icao: aircraft.ICAO24,
      model: aircraft.MODEL,
    });
    return 'helicopter';
  }

  // Final fallback to text-based detection if needed
  const typeString = [aircraft.type, aircraft.TYPE_AIRCRAFT]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (
    typeString.includes('HELICOPTER') ||
    typeString.includes('ROTOR') ||
    typeString.includes('EUROCOPTER')
  ) {
    console.log('Helicopter detected by type description!', {
      icao: aircraft.ICAO24,
      typeString: typeString,
    });
    return 'helicopter';
  }

  // Default to 'default' if no specific type is detected
  return 'default';
};

// Updated getAircraftIconUrl function with country-based icon mapping
export const getAircraftIconUrl = (
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
    on_ground?: boolean;
    TYPE_REGISTRANT?: number;
    ownerType?: number;
    TYPE_AIRCRAFT?: string | number; // FAA type_aircraft code
    COUNTRY?: string; // Country field
  }
): string => {
  // Check if it's a government aircraft
  const isGovernment = aircraft.isGovernment || aircraft.TYPE_REGISTRANT === 5;

  // Check if the aircraft is grounded
  const isGrounded = aircraft.on_ground === true;

  // Determine the base aircraft type
  const aircraftType = determineAircraftType(aircraft);

  // Check if aircraft is from the US or another country
  const isUS =
    !aircraft.COUNTRY ||
    aircraft.COUNTRY.trim().toUpperCase() === 'UNITED STATES' ||
    aircraft.COUNTRY.trim().toUpperCase() === 'US' ||
    aircraft.COUNTRY.trim().toUpperCase() === 'USA';

  // Only use international prefix if aircraft is non-US AND international icons exist
  // For now, just check if the country is set and not US
  const iconPrefix = isUS ? '' : 'intl_';

  console.log('Aircraft Icon Selection:', {
    icao: aircraft.ICAO24,
    model: aircraft.MODEL || 'Unknown',
    aircraftType: aircraftType,
    typeCode: aircraft.TYPE_AIRCRAFT,
    country: aircraft.COUNTRY,
    isUS: isUS,
    isGovernment: isGovernment,
    prefix: iconPrefix,
  });

  // Default to these icon paths if nothing else matches
  let iconPath = '/icons/defaultIconImg.png'; // Default fallback

  // Define a simple mapping for aircraft types to icon filenames
  // If icon doesn't exist on disk, the default "missing image" will display
  if (isGovernment) {
    // Government aircraft icons
    switch (aircraftType) {
      case 'helicopter':
      case 'gyroplane':
        iconPath = `/icons/${iconPrefix}governmentRotorIconImg.png`;
        break;
      default:
        iconPath = `/icons/${iconPrefix}governmentJetIconImg.png`;
        break;
    }
  } else {
    // Civilian aircraft icons
    switch (aircraftType) {
      case 'helicopter':
      case 'gyroplane':
        iconPath = `/icons/${iconPrefix}rotorIconImg.png`;
        break;
      case 'jet':
        iconPath = `/icons/${iconPrefix}jetIconImg.png`;
        break;
      case 'turboprop':
        iconPath = `/icons/${iconPrefix}proplIconImg.png`;
        break;
      case 'balloon':
      case 'blimp':
        iconPath = `/icons/${iconPrefix}aircraft_balloon.png`;
        break;
      case 'glider':
        iconPath = `/icons/${iconPrefix}defaultIconImg.png`;
        break;
      case 'singleEngine':
      case 'twinEngine':
      default:
        iconPath = `/icons/${iconPrefix}defaultIconImg.png`;
        break;
    }
  }

  // Override with grounded icon if the aircraft is on ground and we want to use a different icon
  if (isGrounded && false) {
    // Change to true to enable grounded icons
    iconPath = '/icons/aircraft_grounded.svg';
  }

  console.log(
    `Selected icon path: ${iconPath} for aircraft ${aircraft.ICAO24}`
  );

  // Make a final check to ensure we're returning a valid icon path
  if (!iconPath) {
    console.warn(
      `No icon path found for aircraft ${aircraft.ICAO24}, using default`
    );
    return `/icons/defaultIconImg.png`;
  }

  return iconPath;
};

// Enhanced function to get a more detailed aircraft type description
export const getDetailedAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    TYPE_AIRCRAFT?: string;
    MODEL?: string;
  }
): string => {
  // Use TYPE_AIRCRAFT as primary source if available
  if (aircraft.TYPE_AIRCRAFT) {
    return aircraft.TYPE_AIRCRAFT;
  }

  // Fall back to MODEL if available
  if (aircraft.MODEL) {
    return aircraft.MODEL;
  }

  // Otherwise use our type detection
  const aircraftType = determineAircraftType(aircraft);

  // Map internal type to readable name
  const typeMap: Record<string, string> = {
    balloon: 'Hot Air Balloon',
    helicopter: 'Helicopter',
    jet: 'Jet Aircraft',
    turboprop: 'Turboprop',
    singleEngine: 'Single Engine Piston',
    twinEngine: 'Twin Engine Piston',
    default: 'Aircraft',
  };

  return typeMap[aircraftType] || 'Aircraft';
};

// Create aircraft icon based on aircraft data and options
export const createAircraftIcon = (
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
    on_ground?: boolean;
    TYPE_REGISTRANT?: number;
    ownerType?: number;
    TYPE_AIRCRAFT?: string;
    COUNTRY?: string; // Add COUNTRY field here too
  },
  options: AircraftIconOptions = {}
): L.DivIcon | null => {
  if (typeof window === 'undefined') return null; // SSR guard
  const L = require('leaflet');

  const { isSelected = false, zoomLevel = 9 } = options;
  const size = getIconSizeForZoom(zoomLevel, isSelected);

  // Get the appropriate icon URL based on aircraft type and owner
  const iconUrl = getAircraftIconUrl(aircraft);

  // Determine CSS classes based on aircraft type and status
  const aircraftType = determineAircraftType(aircraft);
  const ownerTypeClass = getOwnerTypeClass(aircraft);
  const statusClass = aircraft.on_ground ? 'grounded' : 'flying';

  // Add country class for additional styling options
  const isUS =
    !aircraft.COUNTRY ||
    aircraft.COUNTRY.trim().toUpperCase() === 'UNITED STATES' ||
    aircraft.COUNTRY.trim().toUpperCase() === 'US' ||
    aircraft.COUNTRY.trim().toUpperCase() === 'USA';
  const countryClass = isUS ? 'us-aircraft' : 'international-aircraft';

  // Get owner type color for border
  const ownerBorderColor = getOwnerBorderColor(
    aircraft.TYPE_REGISTRANT ?? aircraft.ownerType ?? 0
  );

  // Create a completely non-interactive div icon
  const icon = L.divIcon({
    // Use a custom class that is NOT leaflet-interactive
    className: `custom-aircraft-marker ${isSelected ? 'selected' : ''} ${statusClass} ${aircraftType}-type ${ownerTypeClass} ${countryClass}`,
    html: `
      <div class="aircraft-marker" style="
        position: relative;
        width: ${size}px; 
        height: ${size}px; 
        ${isSelected ? 'filter: drop-shadow(0 0 4px #4a80f5);' : ''}
        transition: all 300ms ease;
        pointer-events: none !important;
        z-index: ${isSelected ? 1010 : 1000};
      ">
        <!-- Owner type border element -->
        <div class="owner-type-border" style="
          position: absolute;
          left: -2px;
          top: 0;
          bottom: 0;
          width: 3px;
          background-color: ${ownerBorderColor};
          z-index: 1;
          border-radius: 1.5px;
        "></div>
        <img 
          src="${iconUrl}" 
          style="
            width: 100%; 
            height: 100%; 
            transform: rotate(${aircraft.heading || 0}deg);
            transition: transform 0.3s ease;
            pointer-events: none !important;
            position: relative;
            z-index: 2;
          "
          alt="Aircraft" 
          draggable="false"
        />
        <div class="aircraft-touch-target"></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [0, -size / 2],
    // Critical for preventing flicker:
    interactive: false,
  });

  return icon;
};

// Get readable aircraft type name
export const getReadableAircraftType = (
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

// Get owner type CSS class
export const getOwnerTypeClass = (
  aircraft: Aircraft & {
    TYPE_REGISTRANT?: number;
    ownerType?: number;
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
  return ownerTypeMap[ownerType ?? 0] || 'unknown-owner';
};

// Helper function to convert owner type codes to readable labels
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
  return ownerTypes[ownerTypeNum] || `Type ${ownerTypeNum}`;
};

// Add this function to AircraftIcon.tsx
export const getOwnerBorderColor = (ownerType: number): string => {
  // Map owner types to colors - these should match your CSS colors
  const ownerColorMap: Record<number, string> = {
    1: '#43a047', // Individual - green
    2: '#8e24aa', // Partnership - purple
    3: '#5c6bc0', // Corp-owner - indigo
    4: '#9e9e9e', // Co-owned - gray
    5: '#ffb300', // LLC - amber
    8: '#5c6bc0', // non-citizen-corp - indigo
    9: '#e53935', // Airline - red
    10: '#f57f17', // Freight - deep orange
    11: '#b71c1c', // Medical - dark red
    12: '#9e9e9e', // Media - gray
    13: '#9e9e9e', // Historical - gray
    14: '#9e9e9e', // Flying Club - gray
    15: '#c62828', // Emergency - red
    16: '#0288d1', // Local Govt - blue
    17: '#039be5', // Education - light blue
    18: '#1a75ff', // Federal Govt - blue
    19: '#00897b', // Flight School - teal
    20: '#5c6bc0', // Leasing Corp - indigo
    21: '#9e9e9e', // Military - gray
  };

  // Default color for unknown types
  return ownerColorMap[ownerType] || '#9e9e9e'; // Default to gray
};

// Export utility functions
export default {
  createAircraftIcon,
  getIconSizeForZoom,
  getTooltipFontSize,
  getOwnerTypeLabel,
  getAircraftIconUrl,
  determineAircraftType,
  getReadableAircraftType,
  getOwnerTypeClass,
  getDetailedAircraftType,
};
