// utils/UIStatePersistence.ts
/**
 * Simple, independent UI state persistence utility
 * Handles saving/loading UI state without dependencies on map or component implementations
 */

// Storage key for UI state
const UI_STATE_KEY = 'aircraft_ui_state';

// Maximum age for stored state (2 hours in milliseconds)
const MAX_STATE_AGE = 2 * 60 * 60 * 1000;

/**
 * Save any serializable state to localStorage
 * @param key Identifier for this piece of state
 * @param data Any serializable data to save
 */
export function saveState<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    const fullKey = `${UI_STATE_KEY}.${key}`;
    const stateToSave = {
      data,
      timestamp: Date.now(),
    };

    localStorage.setItem(fullKey, JSON.stringify(stateToSave));
  } catch (error) {
    console.error(`[Persistence] Error saving state for ${key}:`, error);
  }
}

/**
 * Load saved state from localStorage
 * @param key Identifier for the state to load
 * @param maxAge Maximum age in milliseconds (defaults to 2 hours)
 * @returns The stored data, or null if not found or expired
 */
export function loadState<T>(key: string, maxAge = MAX_STATE_AGE): T | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const fullKey = `${UI_STATE_KEY}.${key}`;
    const storedValue = localStorage.getItem(fullKey);

    if (!storedValue) {
      return null;
    }

    const { data, timestamp } = JSON.parse(storedValue);

    // Check if the state is too old
    if (Date.now() - timestamp > maxAge) {
      localStorage.removeItem(fullKey);
      return null;
    }

    return data as T;
  } catch (error) {
    console.error(`[Persistence] Error loading state for ${key}:`, error);
    return null;
  }
}

/**
 * Clear saved state for a specific key
 * @param key Identifier for the state to clear
 */
export function clearState(key: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    const fullKey = `${UI_STATE_KEY}.${key}`;
    localStorage.removeItem(fullKey);
  } catch (error) {
    console.error(`[Persistence] Error clearing state for ${key}:`, error);
  }
}

/**
 * Save the state of which tooltips are visible
 * @param visibleTooltips Array of IDs for visible tooltips
 */
export function saveVisibleTooltips(visibleTooltips: string[]): void {
  saveState('visibleTooltips', visibleTooltips);
}

/**
 * Load the state of which tooltips are visible
 * @returns Array of IDs for visible tooltips, or empty array if none found
 */
export function loadVisibleTooltips(): string[] {
  return loadState<string[]>('visibleTooltips') || [];
}

/**
 * Save the state of which markers are highlighted
 * @param highlightedMarkers Array of IDs for highlighted markers
 */
export function saveHighlightedMarkers(highlightedMarkers: string[]): void {
  saveState('highlightedMarkers', highlightedMarkers);
}

/**
 * Load the state of which markers are highlighted
 * @returns Array of IDs for highlighted markers, or empty array if none found
 */
export function loadHighlightedMarkers(): string[] {
  return loadState<string[]>('highlightedMarkers') || [];
}

/**
 * Save the currently selected aircraft
 * @param aircraftId ID of selected aircraft, or null if none selected
 */
export function saveSelectedAircraft(aircraftId: string | null): void {
  saveState('selectedAircraft', aircraftId);
}

/**
 * Load the currently selected aircraft
 * @returns ID of selected aircraft, or null if none found
 */
export function loadSelectedAircraft(): string | null {
  return loadState<string | null>('selectedAircraft');
}

/**
 * Save map position and zoom level
 * @param center Map center coordinates [lat, lng]
 * @param zoom Map zoom level
 */
export function saveMapPosition(center: [number, number], zoom: number): void {
  saveState('mapPosition', { center, zoom });
}

/**
 * Load map position and zoom level
 * @returns Object with center and zoom, or null if not found
 */
export function loadMapPosition(): {
  center: [number, number];
  zoom: number;
} | null {
  return loadState('mapPosition');
}
