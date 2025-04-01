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

// Get the appropriate icon based on aircraft type and owner
export const getAircraftIconUrl = (
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
    on_ground?: boolean;
    OWNER_TYPE?: string;
    TYPE_AIRCRAFT?: string;
  }
): string => {
  // Check if it's a government aircraft
  const isGovernment = aircraft.isGovernment || aircraft.OWNER_TYPE === '5';

  // Determine the base aircraft type
  const aircraftType = determineAircraftType(aircraft);

  // Icon mapping object
  const iconMap: Record<string, Record<string, string>> = {
    government: {
      helicopter: '/icons/governmentHelicopterIconImg.png',
      jet: '/icons/governmentJetIconImg.png',
      turboprop: '/icons/governmentTurbopropIconImg.png',
      piston: '/icons/governmentPistonIconImg.png',
      default: '/icons/governmentJetIconImg.png',
    },
    civilian: {
      helicopter: '/icons/helicopterIconImg.png',
      jet: '/icons/jetIconImg.png',
      turboprop: '/icons/turbopropIconImg.png',
      singleEngine: '/icons/singleEngineIconImg.png',
      twinEngine: '/icons/twinEngineIconImg.png',
      default: '/icons/jetIconImg.png',
    },
  };

  // Select the appropriate category (government vs civilian)
  const category = isGovernment ? 'government' : 'civilian';

  // Return the appropriate icon URL (with fallback to default)
  return iconMap[category][aircraftType] || iconMap[category].default;
};

// Helper function to determine aircraft type
export const determineAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    TYPE_AIRCRAFT?: string;
  }
): string => {
  // Combine possible type fields for checking
  const typeString = [aircraft.type, aircraft.TYPE_AIRCRAFT, aircraft.model]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Check for different aircraft types
  if (typeString.includes('helicopter') || typeString.includes('rotor')) {
    return 'helicopter';
  }

  if (typeString.includes('jet') || typeString.includes('airliner')) {
    return 'jet';
  }

  if (typeString.includes('turboprop') || typeString.includes('turbo prop')) {
    return 'turboprop';
  }

  if (typeString.includes('twin')) {
    return 'twinEngine';
  }

  if (typeString.includes('single') || typeString.includes('piston')) {
    return 'singleEngine';
  }

  // Default type based on basic checks
  if (
    typeString.includes('cessna') ||
    typeString.includes('piper') ||
    typeString.includes('beech')
  ) {
    return 'singleEngine';
  }

  // Default to jet
  return 'default';
};

// Create aircraft icon based on aircraft data and options
export const createAircraftIcon = (
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
    on_ground?: boolean;
    OWNER_TYPE?: string;
    TYPE_AIRCRAFT?: string;
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

  // Create a completely non-interactive div icon
  const icon = L.divIcon({
    // Use a custom class that is NOT leaflet-interactive
    className: `custom-aircraft-marker ${isSelected ? 'selected' : ''} ${statusClass} ${aircraftType}-type ${ownerTypeClass}`,
    html: `
      <div class="aircraft-marker" style="
        width: ${size}px; 
        height: ${size}px; 
        ${isSelected ? 'filter: drop-shadow(0 0 4px #4a80f5);' : ''}
        transition: all 300ms ease;
        pointer-events: none !important;
        z-index: ${isSelected ? 1010 : 1000};
      ">
        <img 
          src="${iconUrl}" 
          style="
            width: 100%; 
            height: 100%; 
            transform: rotate(${aircraft.heading || 0}deg);
            transition: transform 0.3s ease;
            pointer-events: none !important;
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
    OWNER_TYPE?: string;
    isGovernment?: boolean;
  }
): string => {
  const ownerType = aircraft.OWNER_TYPE || '';

  // Map owner type to CSS class
  const ownerTypeMap: Record<string, string> = {
    '1': 'individual-owner',
    '2': 'partnership-owner',
    '3': 'corporation-owner',
    '4': 'co-owned-owner',
    '5': 'government-owner',
    '7': 'llc-owner',
    '8': 'non-citizen-corp-owner',
    '9': 'non-citizen-co-owned-owner',
  };

  // Default to 'unknown-owner' if type not found
  return ownerTypeMap[ownerType] || 'unknown-owner';
};

// Create tooltip content with improved two-column layout
export const createTooltipContent = (
  aircraft: Aircraft & {
    registration?: string;
    'N-NUMBER'?: string;
    TYPE_AIRCRAFT?: string;
    manufacturer?: string;
    type?: string;
    isGovernment?: boolean;
    OWNER_TYPE?: string;
  },
  zoomLevel: number
): string => {
  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

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

  // Create responsive tooltip with improved two-column layout
  return `
    <div class="aircraft-tooltip-header ${aircraftType}-type ${ownerTypeClass}">
      <div class="aircraft-callsign">${registration}</div>
      <div class="aircraft-model">${aircraft.model || aircraft.TYPE_AIRCRAFT || readableType}</div>
    </div>
    <div class="aircraft-tooltip-content">
      <div class="aircraft-data-grid">
        <div>
          <span class="data-label">Alt:</span>
          <span class="data-value">${formattedAltitude}</span>
        </div>
        <div>
          <span class="data-label">Heading:</span>
          <span class="data-value">${heading}</span>
        </div>
        <div>
          <span class="data-label">Speed:</span>
          <span class="data-value">${formattedSpeed}</span>
        </div>
        ${
          aircraft.on_ground !== undefined
            ? `
        <div>
          <span class="data-label">Status:</span>
          <span class="data-value ${aircraft.on_ground ? 'on-ground-status' : 'in-flight-status'}">${aircraft.on_ground ? 'Ground' : 'Flight'}</span>
        </div>
        `
            : ''
        }
        ${
          zoomLevel >= 10 && aircraft.manufacturer
            ? `
        <div class="aircraft-data-full">
          <span class="data-label">Mfr:</span>
          <span class="data-value">${aircraft.manufacturer}</span>
        </div>
        `
            : ''
        }
        ${
          zoomLevel >= 10 && aircraft.OWNER_TYPE
            ? `
        <div class="aircraft-data-full">
          <span class="data-label">Owner:</span>
          <span class="data-value">${getOwnerTypeLabel(aircraft.OWNER_TYPE)}</span>
        </div>
        `
            : ''
        }
      </div>
      ${
        aircraft.lastSeen
          ? `
      <div class="text-xs text-gray-400 mt-2">
        Updated: ${new Date(aircraft.lastSeen).toLocaleTimeString()}
      </div>
      `
          : ''
      }
    </div>
  `;
};

// Fixed createPopupContent function to ensure all fields are included
export const createPopupContent = (
  aircraft: Aircraft & {
    registration?: string;
    'N-NUMBER'?: string;
    TYPE_AIRCRAFT?: string;
    manufacturer?: string;
    CITY?: string;
    STATE?: string;
    OWNER_TYPE?: string;
    name?: string;
    city?: string; // Added lowercase alternatives
    state?: string;
    type?: string;
    isGovernment?: boolean;
  },
  zoomLevel: number
): string => {
  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

  // Format altitude with commas for thousands
  const formattedAltitude = aircraft.altitude
    ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';

  // Format speed
  const formattedSpeed = aircraft.velocity
    ? Math.round(aircraft.velocity) + ' kts'
    : 'N/A';

  // Get city and state (check both uppercase and lowercase properties)
  const city = aircraft.CITY || aircraft.city || '';
  const state = aircraft.STATE || aircraft.state || '';
  const hasLocation = city || state;

  // Get aircraft type and owner info
  const aircraftType = determineAircraftType(aircraft);
  const ownerTypeClass = getOwnerTypeClass(aircraft);
  const readableType = getReadableAircraftType(aircraft);
  const ownerType = aircraft.OWNER_TYPE
    ? getOwnerTypeLabel(aircraft.OWNER_TYPE)
    : 'Unknown';

  // Format debug info if needed
  const debugInfo =
    process.env.NODE_ENV === 'development'
      ? `<div class="text-xs text-gray-400 mt-2 p-1 bg-gray-100">
      Keys: ${Object.keys(aircraft).join(', ')}
    </div>`
      : '';

  // Type-specific content sections
  let typeSpecificContent = '';

  if (aircraftType === 'helicopter') {
    typeSpecificContent = `
      <div class="type-specific-section helicopter-section mt-3 p-2 bg-indigo-50 rounded">
        <h4 class="font-medium text-indigo-700 mb-1 text-sm">Helicopter Details</h4>
        <div class="grid grid-cols-2 gap-y-1 text-xs">
          <div class="text-gray-600">Type:</div>
          <div class="font-medium">${aircraft.TYPE_AIRCRAFT || 'Rotorcraft'}</div>
          <div class="text-gray-600">Operations:</div>
          <div class="font-medium">Standard Category</div>
        </div>
      </div>
    `;
  } else if (ownerTypeClass === 'government-owner') {
    typeSpecificContent = `
      <div class="type-specific-section government-section mt-3 p-2 bg-red-50 rounded">
        <h4 class="font-medium text-red-700 mb-1 text-sm">Government Aircraft</h4>
        <div class="grid grid-cols-2 gap-y-1 text-xs">
          <div class="text-gray-600">Operations:</div>
          <div class="font-medium">Official Use</div>
          <div class="text-gray-600">Type:</div>
          <div class="font-medium">${readableType}</div>
        </div>
      </div>
    `;
  } else if (aircraftType === 'jet') {
    typeSpecificContent = `
      <div class="type-specific-section jet-section mt-3 p-2 bg-cyan-50 rounded">
        <h4 class="font-medium text-cyan-700 mb-1 text-sm">Jet Aircraft</h4>
        <div class="grid grid-cols-2 gap-y-1 text-xs">
          <div class="text-gray-600">Engine Type:</div>
          <div class="font-medium">Turbofan</div>
          <div class="text-gray-600">Category:</div>
          <div class="font-medium">${aircraft.model?.includes('heavy') ? 'Heavy' : 'Standard'}</div>
        </div>
      </div>
    `;
  }

  // Create responsive popup with all fields properly included
  return `
    <div class="aircraft-popup p-3 ${aircraftType}-popup ${ownerTypeClass}">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-lg font-bold">${registration}</h3>
        <div class="aircraft-type-badge ${aircraftType}-badge">${readableType}</div>
        <button class="text-gray-500 hover:text-gray-700" onclick="window.dispatchEvent(new CustomEvent('close-popup'))">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="grid grid-cols-2 gap-y-2 text-sm">
        <div class="text-gray-600">Model:</div>
        <div class="font-medium">${aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}</div>
        
        ${
          aircraft.manufacturer
            ? `
        <div class="text-gray-600">Manufacturer:</div>
        <div class="font-medium">${aircraft.manufacturer}</div>
        `
            : ''
        }
        
        <div class="text-gray-600">Altitude:</div>
        <div class="font-medium">${formattedAltitude}</div>
        
        <div class="text-gray-600">Speed:</div>
        <div class="font-medium">${formattedSpeed}</div>
        
        ${
          aircraft.heading
            ? `
        <div class="text-gray-600">Heading:</div>
        <div class="font-medium">${Math.round(aircraft.heading)}°</div>
        `
            : ''
        }
        
        ${
          aircraft.name
            ? `
        <div class="text-gray-600">Name:</div>
        <div class="font-medium">${aircraft.name}</div>
        `
            : ''
        }
        
        ${
          hasLocation
            ? `
        <div class="text-gray-600">Location:</div>
        <div class="font-medium">${[city, state].filter(Boolean).join(', ')}</div>
        `
            : ''
        }
        
        ${
          aircraft.OWNER_TYPE
            ? `
        <div class="text-gray-600">Owner Type:</div>
        <div class="font-medium owner-type-indicator ${ownerTypeClass}">${ownerType}</div>
        `
            : ''
        }
        
        ${
          aircraft.on_ground !== undefined
            ? `
        <div class="text-gray-600">Status:</div>
        <div>${
          aircraft.on_ground
            ? '<span class="status-badge on-ground">On Ground</span>'
            : '<span class="status-badge in-flight">In Flight</span>'
        }</div>
        `
            : ''
        }
      </div>
      
      ${typeSpecificContent}
      
      ${debugInfo}
      
      <div class="mt-3 text-center">
        <button class="popup-button ${aircraftType}-button" onclick="window.dispatchEvent(new CustomEvent('select-aircraft', {detail: '${aircraft.icao24}'}))">
          View Details
        </button>
      </div>
    </div>
  `;
};

// Helper function to convert owner type codes to readable labels
export const getOwnerTypeLabel = (ownerType: string): string => {
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

export default {
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
  getIconSizeForZoom,
  getTooltipFontSize,
  getOwnerTypeLabel,
  getAircraftIconUrl,
  determineAircraftType,
  getReadableAircraftType,
  getOwnerTypeClass,
};
