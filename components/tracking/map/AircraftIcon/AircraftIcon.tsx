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

// Create tooltip content with responsiveness
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

  // Adjust content based on zoom level
  const fontSize = getTooltipFontSize(zoomLevel);

  // Create responsive tooltip with the proper CSS classes
  return `
    <div class="p-1">
      <div class="aircraft-callsign">${registration}</div>
      <div class="aircraft-model">${aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}</div>
      <div class="aircraft-data-grid">
        <div>Alt: <span class="font-medium">${formattedAltitude}</span></div>
        <div>Speed: <span class="font-medium">${formattedSpeed}</span></div>
        ${aircraft.heading ? `<div class="col-span-2">Heading: <span class="font-medium">${Math.round(aircraft.heading)}°</span></div>` : ''}
        ${zoomLevel >= 10 && aircraft.manufacturer ? `<div class="col-span-2">${aircraft.manufacturer}</div>` : ''}
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

// Updated createPopupContent function to match existing CSS classes
export const createPopupContent = (
  aircraft: Aircraft & {
    registration?: string;
    'N-NUMBER'?: string;
    TYPE_AIRCRAFT?: string;
    manufacturer?: string;
    CITY?: string;
    STATE?: string;
    OWNER_TYPE?: string;
    owner?: string;
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

  // Create responsive popup with the proper CSS classes
  return `
    <div class="aircraft-popup p-2">
      <h3>${registration}</h3>
      <table>
        <tbody>
          <tr>
            <td>Model:</td>
            <td>${aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}</td>
          </tr>
          ${
            aircraft.manufacturer
              ? `
            <tr>
              <td>Manufacturer:</td>
              <td>${aircraft.manufacturer}</td>
            </tr>
          `
              : ''
          }
          <tr>
            <td>Altitude:</td>
            <td>${formattedAltitude}</td>
          </tr>
          <tr>
            <td>Speed:</td>
            <td>${formattedSpeed}</td>
          </tr>
          ${
            aircraft.heading
              ? `
            <tr>
              <td>Heading:</td>
              <td>${Math.round(aircraft.heading)}°</td>
            </tr>
          `
              : ''
          }
          <tr>
            <td>ICAO:</td>
            <td>${aircraft.icao24}</td>
          </tr>
          ${
            aircraft.owner
              ? `
            <tr>
              <td>Owner:</td>
              <td>${aircraft.owner}</td>
            </tr>
          `
              : ''
          }
          ${
            aircraft.CITY || aircraft.STATE
              ? `
            <tr>
              <td>Location:</td>
              <td>${[aircraft.CITY, aircraft.STATE].filter(Boolean).join(', ')}</td>
            </tr>
          `
              : ''
          }
          ${
            aircraft.OWNER_TYPE
              ? `
            <tr>
              <td>Owner Type:</td>
              <td>${getOwnerTypeLabel(aircraft.OWNER_TYPE)}</td>
            </tr>
          `
              : ''
          }
          ${
            aircraft.lastSeen
              ? `
            <tr>
              <td>Last Seen:</td>
              <td>${new Date(aircraft.lastSeen).toLocaleTimeString()}</td>
            </tr>
          `
              : ''
          }
          ${
            aircraft.on_ground !== undefined
              ? `
            <tr>
              <td>Status:</td>
              <td>
                ${
                  aircraft.on_ground
                    ? '<span class="status-badge on-ground">On Ground</span>'
                    : '<span class="status-badge in-flight">In Flight</span>'
                }
              </td>
            </tr>
          `
              : ''
          }
        </tbody>
      </table>
      <div class="popup-actions">
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
