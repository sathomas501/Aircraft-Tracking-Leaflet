// utils/AircraftUIStatePersistence.ts
import { ExtendedAircraft } from '@/types/base';

// Storage keys
const UI_STATE_KEY = 'aircraft_ui_state';

// Define comprehensive UI state interface
export interface AircraftUIState {
  openPopups: string[]; // Array of ICAOs with open popups
  highlightedMarkers: string[]; // Array of ICAOs with highlighted markers
  expandedPanels: Record<string, boolean>; // Record of expanded info panels by ICAO
  lastViewedDetails: string | null; // Last viewed aircraft details
  lastUpdated: number;
}

/**
 * Save the complete UI state for aircraft markers and popups
 */
export function saveAircraftUIState(state: AircraftUIState): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      UI_STATE_KEY,
      JSON.stringify({
        ...state,
        lastUpdated: Date.now(),
      })
    );
    console.log(
      `[Persistence] Saved UI state with ${state.openPopups.length} open popups and ${state.highlightedMarkers.length} highlighted markers`
    );
  } catch (error) {
    console.error('[Persistence] Error saving aircraft UI state:', error);
  }
}

/**
 * Load the UI state for aircraft markers and popups
 */
export function loadAircraftUIState(): AircraftUIState | null {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const data = localStorage.getItem(UI_STATE_KEY);
    if (!data) return null;

    return JSON.parse(data) as AircraftUIState;
  } catch (error) {
    console.error('[Persistence] Error loading aircraft UI state:', error);
    return null;
  }
}

/**
 * Create an initial empty UI state
 */
export function createEmptyUIState(): AircraftUIState {
  return {
    openPopups: [],
    highlightedMarkers: [],
    expandedPanels: {},
    lastViewedDetails: null,
    lastUpdated: Date.now(),
  };
}

/**
 * Update UI state with a toggled popup
 * @param icao The aircraft ICAO
 * @param isOpen Whether the popup is being opened (true) or closed (false)
 */
export function updatePopupState(icao: string, isOpen: boolean): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  const uiState = loadAircraftUIState() || createEmptyUIState();

  if (isOpen) {
    // Add to open popups if not already present
    if (!uiState.openPopups.includes(icao)) {
      uiState.openPopups.push(icao);
    }
  } else {
    // Remove from open popups
    uiState.openPopups = uiState.openPopups.filter((id) => id !== icao);
  }

  saveAircraftUIState(uiState);
}

/**
 * Update UI state with a highlighted marker
 * @param icao The aircraft ICAO
 * @param isHighlighted Whether the marker is being highlighted (true) or unhighlighted (false)
 */
export function updateMarkerHighlight(
  icao: string,
  isHighlighted: boolean
): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  const uiState = loadAircraftUIState() || createEmptyUIState();

  if (isHighlighted) {
    // Add to highlighted markers if not already present
    if (!uiState.highlightedMarkers.includes(icao)) {
      uiState.highlightedMarkers.push(icao);
    }
  } else {
    // Remove from highlighted markers
    uiState.highlightedMarkers = uiState.highlightedMarkers.filter(
      (id) => id !== icao
    );
  }

  saveAircraftUIState(uiState);
}

/**
 * Update expanded panel state
 * @param icao The aircraft ICAO
 * @param panelKey Identifier for the specific panel
 * @param isExpanded Whether the panel is expanded (true) or collapsed (false)
 */
export function updatePanelExpansion(
  icao: string,
  panelKey: string,
  isExpanded: boolean
): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  const uiState = loadAircraftUIState() || createEmptyUIState();

  // Create the key for the panel
  const key = `${icao}:${panelKey}`;

  // Update the expanded state
  uiState.expandedPanels[key] = isExpanded;

  saveAircraftUIState(uiState);
}

/**
 * Get panel expansion state
 * @param icao The aircraft ICAO
 * @param panelKey Identifier for the specific panel
 * @returns boolean indicating if panel should be expanded
 */
export function getPanelExpansion(icao: string, panelKey: string): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  const uiState = loadAircraftUIState();
  if (!uiState) return false;

  const key = `${icao}:${panelKey}`;
  return uiState.expandedPanels[key] || false;
}

/**
 * Update last viewed aircraft details
 * @param icao The aircraft ICAO
 */
export function updateLastViewedDetails(icao: string | null): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  const uiState = loadAircraftUIState() || createEmptyUIState();
  uiState.lastViewedDetails = icao;
  saveAircraftUIState(uiState);
}

/**
 * Clear all UI state
 */
export function clearAircraftUIState(): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(UI_STATE_KEY);
    console.log('[Persistence] Cleared all aircraft UI state');
  } catch (error) {
    console.error('[Persistence] Error clearing aircraft UI state:', error);
  }
}

/**
 * Check if the UI state is recent enough to restore
 * @param maxAge Maximum age in milliseconds (default: 1 hour)
 * @returns boolean indicating if state is recent
 */
export function isUIStateRecent(maxAge: number = 3600000): boolean {
  const uiState = loadAircraftUIState();
  if (!uiState) return false;

  return Date.now() - uiState.lastUpdated < maxAge;
}
