// utils/AircraftDataPersistance.ts
import { CachedAircraftData, ExtendedAircraft } from '@/types/base';

// Storage keys
const AIRCRAFT_DATA_KEY = 'aircraft_tracking_data';
const MAP_STATE_KEY = 'aircraft_map_state';
const SELECTED_AIRCRAFT_KEY = 'selected_aircraft';
const TRAIL_STATE_KEY = 'aircraft_trail_state';

// Define the structure for map state persistence
interface MapState {
  center: [number, number];
  zoom: number;
  lastUpdated: number;
}

// Define trail state interface
interface TrailState {
  enabled: boolean;
  maxLength: number;
  trails: Record<
    string,
    Array<{ lat: number; lng: number; alt: number | null; timestamp: number }>
  >;
  lastUpdated: number;
}

/**
 * Save aircraft data to localStorage
 */
export function saveAircraftData(
  data: Record<string, CachedAircraftData>
): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(AIRCRAFT_DATA_KEY, JSON.stringify(data));
    console.log(
      `[Persistence] Saved ${Object.keys(data).length} aircraft to localStorage`
    );
  } catch (error) {
    console.error('[Persistence] Error saving aircraft data:', error);
    // Handle quota exceeded errors
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // Clear older entries to make room
      pruneOldAircraftData(data);
    }
  }
}

/**
 * Load aircraft data from localStorage
 */
export function loadAircraftData(): Record<string, CachedAircraftData> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const data = localStorage.getItem(AIRCRAFT_DATA_KEY);
    if (!data) return {};

    const parsed = JSON.parse(data) as Record<string, CachedAircraftData>;
    console.log(
      `[Persistence] Loaded ${Object.keys(parsed).length} aircraft from localStorage`
    );

    // Filter out stale data (older than 24 hours)
    return filterStaleData(parsed);
  } catch (error) {
    console.error('[Persistence] Error loading aircraft data:', error);
    return {};
  }
}

/**
 * Clear all aircraft data from localStorage
 */
export function clearAircraftData(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(AIRCRAFT_DATA_KEY);
    console.log('[Persistence] Cleared all aircraft data from localStorage');
  } catch (error) {
    console.error('[Persistence] Error clearing aircraft data:', error);
  }
}

/**
 * Save map state to localStorage
 */
export function saveMapState(center: [number, number], zoom: number): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    const mapState: MapState = {
      center,
      zoom,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(MAP_STATE_KEY, JSON.stringify(mapState));
  } catch (error) {
    console.error('[Persistence] Error saving map state:', error);
  }
}

/**
 * Load map state from localStorage
 */
export function loadMapState(): MapState | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const data = localStorage.getItem(MAP_STATE_KEY);
    if (!data) return null;

    return JSON.parse(data) as MapState;
  } catch (error) {
    console.error('[Persistence] Error loading map state:', error);
    return null;
  }
}

/**
 * Save selected aircraft ICAO to localStorage
 */
export function saveSelectedAircraft(icao: string | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    if (icao) {
      localStorage.setItem(SELECTED_AIRCRAFT_KEY, icao);
    } else {
      localStorage.removeItem(SELECTED_AIRCRAFT_KEY);
    }
  } catch (error) {
    console.error('[Persistence] Error saving selected aircraft:', error);
  }
}

/**
 * Load selected aircraft ICAO from localStorage
 */
export function loadSelectedAircraft(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(SELECTED_AIRCRAFT_KEY);
  } catch (error) {
    console.error('[Persistence] Error loading selected aircraft:', error);
    return null;
  }
}

/**
 * Save trail state to localStorage
 */
export function saveTrailState(state: TrailState): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    // Limit the number of trails saved to avoid storage limits
    const limitedTrails: TrailState = {
      ...state,
      trails: {},
    };

    // Only save max 20 trails to avoid storage issues
    const icaos = Object.keys(state.trails).slice(0, 20);

    // For each saved trail, limit the number of points
    icaos.forEach((icao) => {
      // Limit each trail to 100 points max (about 5-10 minutes of data)
      const trail = state.trails[icao];
      limitedTrails.trails[icao] = trail.slice(Math.max(0, trail.length - 100));
    });

    localStorage.setItem(TRAIL_STATE_KEY, JSON.stringify(limitedTrails));
    console.log(`[Persistence] Saved trail state with ${icaos.length} trails`);
  } catch (error) {
    console.error('[Persistence] Error saving trail state:', error);
  }
}

/**
 * Load trail state from localStorage
 */
export function loadTrailState(): TrailState | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const data = localStorage.getItem(TRAIL_STATE_KEY);
    if (!data) return null;

    return JSON.parse(data) as TrailState;
  } catch (error) {
    console.error('[Persistence] Error loading trail state:', error);
    return null;
  }
}

/**
 * Filter out stale data (older than 24 hours)
 */
function filterStaleData(
  data: Record<string, CachedAircraftData>
): Record<string, CachedAircraftData> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
  const filtered: Record<string, CachedAircraftData> = {};

  for (const [icao, aircraft] of Object.entries(data)) {
    // Skip if lastUpdated is missing or too old
    if (!aircraft.lastUpdated || aircraft.lastUpdated < cutoff) {
      continue;
    }

    filtered[icao] = aircraft;
  }

  const removedCount = Object.keys(data).length - Object.keys(filtered).length;
  if (removedCount > 0) {
    console.log(`[Persistence] Filtered out ${removedCount} stale aircraft`);
  }

  return filtered;
}

/**
 * Prune old aircraft data when storage quota is exceeded
 */
function pruneOldAircraftData(data: Record<string, CachedAircraftData>): void {
  // Sort by lastUpdated timestamp (oldest first)
  const sortedEntries = Object.entries(data).sort(
    ([, a], [, b]) => (a.lastUpdated || 0) - (b.lastUpdated || 0)
  );

  // Remove the oldest 25% of entries
  const toRemove = Math.ceil(sortedEntries.length * 0.25);
  const prunedData: Record<string, CachedAircraftData> = {};

  // Keep only the newer 75%
  sortedEntries.slice(toRemove).forEach(([icao, aircraft]) => {
    prunedData[icao] = aircraft;
  });

  console.log(
    `[Persistence] Pruned ${toRemove} aircraft to save storage space`
  );

  // Try saving again with reduced data
  try {
    localStorage.setItem(AIRCRAFT_DATA_KEY, JSON.stringify(prunedData));
  } catch (error) {
    // If still failing, clear everything
    console.error(
      '[Persistence] Still exceeding quota after pruning, clearing all data'
    );
    clearAircraftData();
  }
}

/**
 * Merge current aircraft data with cached data
 * Prioritize dynamic fields from current data, preserve static fields from cache
 */
export function mergeAircraftData(
  cachedData: Record<string, CachedAircraftData>,
  currentData: Record<string, CachedAircraftData>
): Record<string, CachedAircraftData> {
  const result: Record<string, CachedAircraftData> = { ...cachedData };

  // Process all current aircraft
  for (const [icao, currentAircraft] of Object.entries(currentData)) {
    const cachedAircraft = cachedData[icao];

    if (!cachedAircraft) {
      // No cached data, just use current data
      result[icao] = {
        ...currentAircraft,
        lastUpdated: Date.now(),
      };
      continue;
    }

    // Merge with prioritization of fields
    result[icao] = mergeAircraftFields(cachedAircraft, currentAircraft);
  }

  return result;
}

/**
 * Merge fields from two aircraft objects with field-specific priorities
 */
function mergeAircraftFields(
  cached: CachedAircraftData,
  current: CachedAircraftData
): CachedAircraftData {
  // Create a new object to avoid mutating the original
  const result = { ...cached } as Record<string, any>;

  // Always update these dynamic position fields from current data
  const dynamicFields = [
    'latitude',
    'longitude',
    'altitude',
    'velocity',
    'heading',
    'on_ground',
    'last_contact',
  ];

  // Update all dynamic fields from current data
  for (const field of dynamicFields) {
    if (current[field as keyof CachedAircraftData] !== undefined) {
      result[field] = current[field as keyof CachedAircraftData];
    }
  }

  // Update static fields only if they have values in current data
  const staticFields = [
    'registration',
    'MODEL',
    'MANUFACTURER',
    'N_NUMBER',
    'AIRCRAFT_TYPE',
    'NAME',
    'OWNER_TYPE',
    'CITY',
    'STATE',
  ];

  for (const field of staticFields) {
    const key = field as keyof typeof current;
    if (
      current[key] !== undefined &&
      current[key] !== null &&
      current[key] !== ''
    ) {
      result[field] = current[key];
    }
  }

  // Always update timestamp
  result.lastUpdated = Date.now();

  return result as CachedAircraftData;
}

/**
 * Get a session-persistent unique ID
 * This helps with tracking UI state across refreshes
 * Safe for server-side rendering
 */
export function getSessionId(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    // Return a temporary ID for server-side rendering
    return `temp_session_${Date.now()}`;
  }

  // Browser environment
  let id = sessionStorage.getItem('aircraft_tracking_session_id');
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('aircraft_tracking_session_id', id);
  }
  return id;
}
