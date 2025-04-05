// components/tracking/utils/AircraftIcon.tsx
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

// Updated getAircraftIconUrl function with more specific icon mapping
export const getAircraftIconUrl = (
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
    on_ground?: boolean;
    OWNER_TYPE?: string;
    AIRCRAFT_TYPE?: string;
    type_aircraft?: string; // Add the FAA type_aircraft field
  }
): string => {
  // Check if it's a government aircraft
  const isGovernment = aircraft.isGovernment || aircraft.OWNER_TYPE === '5';

  // Check if the aircraft is grounded
  const isGrounded = aircraft.on_ground === true;

  // Determine the base aircraft type
  const aircraftType = determineAircraftType(aircraft);

  // Log the detected aircraft type and FAA code to debug
  console.log('Aircraft Details:', {
    icao: aircraft.ICAO24,
    model: aircraft.MODEL,
    aircraftType: aircraft.AIRCRAFT_TYPE,
    faaTypeCode: aircraft.type_aircraft,
    detectedType: aircraftType,
    isSikorsky:
      (aircraft.MODEL || '').toLowerCase().includes('s-76') ||
      (aircraft.AIRCRAFT_TYPE || '').toLowerCase().includes('sikorsky'),
  });

  // Icon mapping object with more specific icons
  const iconMap: Record<string, Record<string, string>> = {
    government: {
      helicopter: '/icons/governmentRotorIconImg.png',
      glider: '/icons/governmentJetIconImg.png', // Fall back to jet for government glider
      balloon: '/icons/governmentJetIconImg.png', // Fall back to jet for government balloon
      blimp: '/icons/governmentJetIconImg.png', // Fall back to jet for government blimp
      singleEngine: '/icons/governmentJetIconImg.png',
      twinEngine: '/icons/governmentJetIconImg.png',
      weightshift: '/icons/governmentJetIconImg.png',
      parachute: '/icons/governmentJetIconImg.png',
      gyroplane: '/icons/governmentRotorIconImg.png', // Use rotor for gyroplane
      hybrid: '/icons/governmentJetIconImg.png',
      other: '/icons/governmentJetIconImg.png',
      jet: '/icons/governmentJetIconImg.png',
      turboprop: '/icons/governmentJetIconImg.png',
      default: '/icons/governmentJetIconImg.png',
    },
    civilian: {
      helicopter: '/icons/rotorIconImg.png',
      glider: '/icons/defaultIconImg.png',
      balloon: '/icons/aircraft_balloon.png',
      blimp: '/icons/aircraft_balloon.png', // Use balloon for blimp
      singleEngine: '/icons/defaultIconImg.png',
      twinEngine: '/icons/defaultIconImg.png',
      weightshift: '/icons/defaultIconImg.png',
      parachute: '/icons/defaultIconImg.png',
      gyroplane: '/icons/rotorIconImg.png', // Use rotor for gyroplane
      hybrid: '/icons/defaultIconImg.png',
      other: '/icons/defaultIconImg.png',
      jet: '/icons/jetIconImg.png',
      turboprop: '/icons/proplIconImg.png',
      default: '/icons/defaultIconImg.png',
    },
    grounded: {
      // For grounded aircraft, can use a specific grounded icon SVG
      default: '/icons/aircraft_grounded.svg',
    },
  };

  // Select the appropriate category (government, civilian, or grounded)
  let category = isGovernment ? 'government' : 'civilian';

  // Override with grounded category if the aircraft is on ground and we want to show a different icon
  if (isGrounded && false) {
    // Set to true if you want to use grounded icons
    category = 'grounded';
    return iconMap.grounded.default;
  }

  // Special case for all Sikorsky S-76 variants
  if (
    (aircraft.MODEL || '').includes('S-76') ||
    (aircraft.MODEL || '').includes('S76') ||
    (aircraft.AIRCRAFT_TYPE || '').includes('SIKORSKY S-76') ||
    (aircraft.AIRCRAFT_TYPE || '').includes('SIKORSKY S76')
  ) {
    console.log(
      'SPECIAL OVERRIDE: Forcing helicopter icon for Sikorsky S-76 variant:',
      aircraft.MODEL
    );
    return iconMap[category]['helicopter'];
  }

  // Return the appropriate icon URL (with fallback to default)
  if (aircraftType === 'helicopter' || aircraftType === 'gyroplane') {
    return iconMap[category]['helicopter'];
  }

  return iconMap[category][aircraftType] || iconMap[category].default;
};

// Enhanced determineAircraftType function with more specific type detection
export const determineAircraftType = (
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

  // Manufacturer-based types
  if (typeString.includes('cessna')) {
    return typeString.includes('twin') ? 'twinEngine' : 'singleEngine';
  }

  if (typeString.includes('piper')) {
    return 'singleEngine';
  }

  if (typeString.includes('beech') || typeString.includes('beechcraft')) {
    return typeString.includes('king air') ? 'turboprop' : 'twinEngine';
  }

  if (typeString.includes('cirrus')) {
    return 'singleEngine';
  }

  if (typeString.includes('boeing') || typeString.includes('airbus')) {
    return 'jet';
  }

  if (typeString.includes('diamond')) {
    return 'singleEngine';
  }

  if (typeString.includes('mooney')) {
    return 'singleEngine';
  }

  if (typeString.includes('bombardier') || typeString.includes('embraer')) {
    return 'jet';
  }

  // Default to type based on basic inference
  if (typeString.includes('172') || typeString.includes('152')) {
    return 'singleEngine';
  }

  // Default to jet for unknown types
  return 'default';
};

// Enhanced function to get a more detailed aircraft type description
export const getDetailedAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    AIRCRAFT_TYPE?: string;
    MODEL?: string;
  }
): string => {
  // Use AIRCRAFT_TYPE as primary source if available
  if (aircraft.AIRCRAFT_TYPE) {
    return aircraft.AIRCRAFT_TYPE;
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
    OWNER_TYPE?: string;
    AIRCRAFT_TYPE?: string;
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

  // Get owner type color for border
  const ownerBorderColor = getOwnerBorderColor(aircraft.OWNER_TYPE || '');

  // Create a completely non-interactive div icon
  const icon = L.divIcon({
    // Use a custom class that is NOT leaflet-interactive
    className: `custom-aircraft-marker ${isSelected ? 'selected' : ''} ${statusClass} ${aircraftType}-type ${ownerTypeClass}`,
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

// Get owner type CSS class
export const getOwnerTypeClass = (
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

// Helper function to convert owner type codes to readable labels
export const getOwnerTypeLabel = (ownerType: string): string => {
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

// Add this function to AircraftIcon.tsx
export const getOwnerBorderColor = (ownerType: string): string => {
  // Map owner types to colors - these should match your CSS colors
  const ownerColorMap: Record<string, string> = {
    '1': '#43a047', // Individual - green
    '2': '#8e24aa', // Partnership - purple
    '3': '#5c6bc0', // Corp-owner - indigo
    '4': '#9e9e9e', // Co-owned - gray
    '7': '#ffb300', // LLC - amber
    '8': '#5c6bc0', // non-citizen-corp - indigo
    '9': '#e53935', // Airline - red
    '10': '#f57f17', // Freight - deep orange
    '11': '#b71c1c', // Medical - dark red
    '12': '#9e9e9e', // Media - gray
    '13': '#9e9e9e', // Historical - gray
    '14': '#9e9e9e', // Flying Club - gray
    '15': '#c62828', // Emergency - red
    '16': '#0288d1', // Local Govt - blue
    '17': '#039be5', // Education - light blue
    '18': '#1a75ff', // Federal Govt - blue
    '19': '#00897b', // Flight School - teal
    '20': '#5c6bc0', // Leasing Corp - indigo
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
