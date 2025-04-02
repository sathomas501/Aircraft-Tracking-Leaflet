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
  }
): string => {
  // Check if it's a government aircraft
  const isGovernment = aircraft.isGovernment || aircraft.OWNER_TYPE === '5';

  // Check if the aircraft is grounded
  const isGrounded = aircraft.on_ground === true;

  // Determine the base aircraft type
  const aircraftType = determineAircraftType(aircraft);

  // Icon mapping object with more specific icons
  const iconMap: Record<string, Record<string, string>> = {
    government: {
      helicopter: '/icons/governmentRotorIconImg.png',
      jet: '/icons/governmentJetIconImg.png',
      turboprop: '/icons/governmentJetIconImg.png', // Fall back to jet for government turboprop
      piston: '/icons/governmentJetIconImg.png', // Fall back to jet for government piston
      default: '/icons/governmentJetIconImg.png',
    },
    civilian: {
      balloon: '/icons/aircraft_balloon.png',
      helicopter: '/icons/rotorIconImg.png',
      jet: '/icons/jetIconImg.png',
      turboprop: '/icons/proplIconImg.png',
      singleEngine: '/icons/defaultIconImg.png',
      twinEngine: '/icons/defaultIconImg.png',
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

  // Return the appropriate icon URL (with fallback to default)
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

// Enhanced tooltip content with owner type classes applied properly
export const createTooltipContent = (
  aircraft: Aircraft & {
    registration?: string;
    N_NUMBER?: string;
    AIRCRAFT_TYPE?: string;
    MANUFACTURER?: string;
    type?: string;
    isGovernment?: boolean;
    OWNER_TYPE?: string;
  },
  zoomLevel: number
): string => {
  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft['N_NUMBER'] || aircraft.ICAO24;

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

  // IMPORTANT: Apply the owner type class to the entire tooltip
  // This ensures the owner-specific styling is applied properly
  return `
    <div class="aircraft-tooltip-wrapper ${ownerTypeClass}">
      <div class="aircraft-tooltip-header ${aircraftType}-type">
        <div class="aircraft-callsign">${registration}</div>
        <div class="aircraft-MODEL">${aircraft.MODEL || aircraft.AIRCRAFT_TYPE || readableType}</div>
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
            zoomLevel >= 10 && aircraft.MANUFACTURER
              ? `
          <div class="aircraft-data-full">
            <span class="data-label">Mfr:</span>
            <span class="data-value">${aircraft.MANUFACTURER}</span>
          </div>
          `
              : ''
          }
          ${
            zoomLevel >= 10 && aircraft.OWNER_TYPE
              ? `
          <div class="aircraft-data-full">
            <span class="data-label">Owner:</span>
            <span class="data-value owner-type-indicator ${ownerTypeClass}">${getOwnerTypeLabel(aircraft.OWNER_TYPE)}</span>
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
    </div>
  `;
};

// Enhanced popup content with collapsible functionality
export const createPopupContent = (
  aircraft: Aircraft & {
    registration?: string;
    N_NUMBER?: string;
    AIRCRAFT_TYPE?: string;
    MANUFACTURER?: string;
    CITY?: string;
    STATE?: string;
    OWNER_TYPE?: string;
    name?: string;
    city?: string;
    state?: string;
    type?: string;
    isGovernment?: boolean;
  },
  zoomLevel: number
): string => {
  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft['N_NUMBER'] || aircraft.ICAO24;

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

  return `
    <div class="aircraft-popup p-3 ${aircraftType}-popup ${ownerTypeClass}">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-lg font-bold">${registration}</h3>
        <div class="flex items-center">
          <div class="aircraft-type-badge ${aircraftType}-badge mr-2">${readableType}</div>
          <button id="toggleDetailsBtn" class="toggle-details-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <button class="text-gray-500 hover:text-gray-700" onclick="window.dispatchEvent(new CustomEvent('close-popup'))">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Always visible summary information -->
      <div class="aircraft-summary grid grid-cols-2 gap-y-2 text-sm">
        <div class="text-gray-600">Model:</div>
        <div class="font-medium">${aircraft.MODEL || aircraft.AIRCRAFT_TYPE || 'Unknown'}</div>
        
        <div class="text-gray-600">Altitude:</div>
        <div class="font-medium">${formattedAltitude}</div>
        
        <div class="text-gray-600">Speed:</div>
        <div class="font-medium">${formattedSpeed}</div>
        
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
      
      <!-- Collapsible detailed information -->
      <div id="detailedInfo" class="aircraft-details hidden">
        <div class="grid grid-cols-2 gap-y-2 text-sm">
          ${
            aircraft.MANUFACTURER
              ? `
          <div class="text-gray-600">Manufacturer:</div>
          <div class="font-medium">${aircraft.MANUFACTURER}</div>
          `
              : ''
          }
          
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
        </div>
      </div>
      
      <div class="mt-3 text-center">
        <button class="popup-button ${ownerTypeClass}" onclick="window.dispatchEvent(new CustomEvent('select-aircraft', {detail: '${aircraft.ICAO24}'}))">
          View Details
        </button>
      </div>
    </div>
    
    <script>
      (function() {
        // Get elements
        const toggleBtn = document.getElementById('toggleDetailsBtn');
        const detailedInfo = document.getElementById('detailedInfo');
        
        if (toggleBtn && detailedInfo) {
          // Toggle detailed info on click
          toggleBtn.addEventListener('click', function() {
            const isHidden = detailedInfo.classList.contains('hidden');
            
            if (isHidden) {
              detailedInfo.classList.remove('hidden');
              toggleBtn.classList.add('expanded');
            } else {
              detailedInfo.classList.add('hidden');
              toggleBtn.classList.remove('expanded');
            }
          });
        }
      })();
    </script>
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

// At the bottom of AircraftIcon.tsx, add the new functions to your export:
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
  // Add the new functions:
  getDetailedAircraftType,
};
