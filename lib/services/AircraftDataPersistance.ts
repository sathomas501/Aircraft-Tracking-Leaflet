// AircraftDataPersistence.ts
import type { Aircraft } from '@/types/base';

const STORAGE_KEY = 'aircraft-persistence-data';
const DATA_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Save aircraft data to local storage with timestamp
 */
export const saveAircraftData = (
  aircraftMap: Record<string, Aircraft & Record<string, any>>
): void => {
  try {
    const dataToSave = {
      timestamp: Date.now(),
      aircraftMap,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    console.log(`Saved data for ${Object.keys(aircraftMap).length} aircraft`);
  } catch (error) {
    console.error('Error saving aircraft data to localStorage:', error);
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
        'Failed to save aircraft data even after cleanup:',
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
  Aircraft & Record<string, any>
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
      console.log('Cached aircraft data expired, will fetch fresh data');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    console.log(
      `Loaded data for ${Object.keys(parsedData.aircraftMap).length} aircraft from cache`
    );
    return parsedData.aircraftMap;
  } catch (error) {
    console.error('Error loading aircraft data from localStorage:', error);
    return null;
  }
};

/**
 * Clear aircraft data from local storage
 */
export const clearAircraftData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing aircraft data from localStorage:', error);
  }
};

/**
 * Merge new aircraft data with existing data
 * This prevents data loss when partial updates are received
 */
export const mergeAircraftData = (
  existingData: Record<string, Aircraft & Record<string, any>>,
  newData: Record<string, Aircraft & Record<string, any>>
): Record<string, Aircraft & Record<string, any>> => {
  const mergedData = { ...existingData };

  // Update existing entries with new data, preserving fields that aren't in the new data
  Object.entries(newData).forEach(([icao24, aircraft]) => {
    mergedData[icao24] = {
      ...mergedData[icao24], // Start with existing data
      ...aircraft, // Update with new data
      lastUpdated: Date.now(),
    };
  });

  return mergedData;
};
