// AircraftIcon.tsx
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

// Create aircraft icon based on aircraft data and options
export const createAircraftIcon = (
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
    on_ground?: boolean;
  },
  options: AircraftIconOptions = {}
): L.DivIcon | null => {
  if (typeof window === 'undefined') return null; // SSR guard
  const L = require('leaflet');

  const { isSelected = false, zoomLevel = 9 } = options;
  const size = getIconSizeForZoom(zoomLevel, isSelected);

  let iconUrl = '/icons/jetIconImg.png';
  if (aircraft.isGovernment) iconUrl = '/icons/governmentJetIconImg.png';
  else if (aircraft.type === 'helicopter')
    iconUrl = '/icons/helicopterIconImg.png';

  // Create a completely non-interactive div icon
  const icon = L.divIcon({
    // Use a custom class that is NOT leaflet-interactive
    className: `custom-aircraft-marker ${isSelected ? 'selected' : ''} ${aircraft.on_ground ? 'grounded' : ''}`,
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

// Create tooltip content with improved two-column layout
export const createTooltipContent = (
  aircraft: Aircraft & {
    registration?: string;
    'N-NUMBER'?: string;
    TYPE_AIRCRAFT?: string;
    manufacturer?: string;
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

  // Create responsive tooltip with improved two-column layout
  return `
    <div class="aircraft-tooltip-header">
      <div class="aircraft-callsign">${registration}</div>
      <div class="aircraft-model">${aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}</div>
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
          <span class="data-value">${aircraft.on_ground ? 'Ground' : 'Flight'}</span>
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

  // Format debug info if needed
  const debugInfo =
    process.env.NODE_ENV === 'development'
      ? `<div class="text-xs text-gray-400 mt-2 p-1 bg-gray-100">
      Keys: ${Object.keys(aircraft).join(', ')}
    </div>`
      : '';

  // Create responsive popup with all fields properly included
  return `
    <div class="aircraft-popup p-3">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-lg font-bold">${registration}</h3>
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
        <div class="font-medium">${getOwnerTypeLabel(aircraft.OWNER_TYPE)}</div>
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
      
      ${debugInfo}
      
      <div class="mt-3 text-center">
        <button class="popup-button" onclick="window.dispatchEvent(new CustomEvent('select-aircraft', {detail: '${aircraft.icao24}'}))">
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
};
