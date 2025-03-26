// utils/AircraftDataPersistence.ts
import type { CachedAircraftData } from '@/types/base';

const STORAGE_KEY = 'enhanced-aircraft-data';
const DATA_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Save aircraft data to local storage with timestamp
 */
export const saveAircraftData = (
  aircraftMap: Record<string, CachedAircraftData>
): void => {
  try {
    const dataToSave = {
      timestamp: Date.now(),
      aircraftMap,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    console.log(
      `[AircraftDataPersistence] Saved data for ${Object.keys(aircraftMap).length} aircraft`
    );
  } catch (error) {
    console.error('[AircraftDataPersistence] Error saving data:', error);
    // If localStorage is full, try to clear old data
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          aircraftMap: aircraftMap,
        })
      );
    } catch (retryError) {
      console.error(
        '[AircraftDataPersistence] Failed to save data even after cleanup:',
        retryError
      );
    }
  }
};

/**
 * Load aircraft data from local storage
 * Returns null if no data exists or if data is expired
 */
export const loadAircraftData = (): Record<
  string,
  CachedAircraftData
> | null => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) {
      return null;
    }

    const parsedData = JSON.parse(savedData);
    const timestamp = parsedData.timestamp;
    const now = Date.now();

    // Check if data is expired
    if (now - timestamp > DATA_EXPIRY_TIME) {
      console.log(
        '[AircraftDataPersistence] Cached data expired, will fetch fresh data'
      );
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    console.log(
      `[AircraftDataPersistence] Loaded data for ${Object.keys(parsedData.aircraftMap).length} aircraft from cache`
    );
    return parsedData.aircraftMap;
  } catch (error) {
    console.error('[AircraftDataPersistence] Error loading data:', error);
    return null;
  }
};

/**
 * Clear aircraft data from local storage
 */
export const clearAircraftData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[AircraftDataPersistence] Cleared aircraft data from storage');
  } catch (error) {
    console.error('[AircraftDataPersistence] Error clearing data:', error);
  }
};

/**
 * Merge new aircraft data with existing data
 * This prevents data loss when partial updates are received
 */
export const mergeAircraftData = (
  existingData: Record<string, CachedAircraftData>,
  newData: Record<string, CachedAircraftData>
): Record<string, CachedAircraftData> => {
  const mergedData: Record<string, CachedAircraftData> = { ...existingData };

  // Update existing entries with new data, preserving fields that aren't in the new data
  Object.entries(newData).forEach(([icao24, aircraft]) => {
    // If the aircraft already exists, merge the data
    if (mergedData[icao24]) {
      const merged: CachedAircraftData = {
        ...mergedData[icao24], // Start with existing data (preserves all fields)
        ...aircraft, // Update with new data
        // Keep certain fields from old data if they're missing in new data
        manufacturer: aircraft.manufacturer || mergedData[icao24].manufacturer,
        model: aircraft.model || mergedData[icao24].model,
        'N-NUMBER': aircraft['N-NUMBER'] || mergedData[icao24]['N-NUMBER'],
        TYPE_AIRCRAFT:
          aircraft.TYPE_AIRCRAFT || mergedData[icao24].TYPE_AIRCRAFT,
        CITY: aircraft.CITY || mergedData[icao24].CITY,
        STATE: aircraft.STATE || mergedData[icao24].STATE,
        OWNER_TYPE: aircraft.OWNER_TYPE || mergedData[icao24].OWNER_TYPE,
        NAME: aircraft.NAME || mergedData[icao24].NAME,
        // Always update with fresh position and status data
        latitude: aircraft.latitude,
        longitude: aircraft.longitude,
        altitude: aircraft.altitude,
        velocity: aircraft.velocity,
        heading: aircraft.heading,
        on_ground: aircraft.on_ground,
      };

      // Add lastUpdated separately to avoid TypeScript errors
      merged.lastUpdated = Date.now();

      mergedData[icao24] = merged;
    } else {
      // If it's a new aircraft, just add it
      const newAircraft: CachedAircraftData = { ...aircraft };
      // Add lastUpdated separately to avoid TypeScript errors
      newAircraft.lastUpdated = Date.now();
      mergedData[icao24] = newAircraft;
    }
  });

  return mergedData;
};
