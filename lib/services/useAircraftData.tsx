// useAircraftData.tsx
import { useState, useEffect, useCallback } from 'react';
import type { Aircraft } from '@/types/base';
import {
  saveAircraftData,
  loadAircraftData,
  mergeAircraftData,
} from '../services/AircraftDataPersistance';

interface UseAircraftDataProps {
  apiEndpoint?: string;
  refreshInterval?: number; // in milliseconds
  initialLoad?: boolean;
}

/**
 * React hook to manage aircraft data with persistence
 */
export function useAircraftData({
  apiEndpoint = '/api/aircraft',
  refreshInterval = 15000,
  initialLoad = true,
}: UseAircraftDataProps = {}) {
  const [aircraftMap, setAircraftMap] = useState<
    Record<string, Aircraft & Record<string, any>>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Load saved data from localStorage on mount
  useEffect(() => {
    const savedData = loadAircraftData();
    if (savedData) {
      setAircraftMap(savedData);
      setLastUpdated(Date.now());
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(aircraftMap).length > 0) {
      saveAircraftData(aircraftMap);
    }
  }, [aircraftMap]);

  // Fetch aircraft data from API with data merging
  const fetchAircraftData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoint);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Process the data into a map by ICAO24 address
      const newAircraftMap: Record<string, Aircraft & Record<string, any>> = {};

      data.forEach((aircraft: Aircraft & Record<string, any>) => {
        if (aircraft.icao24) {
          newAircraftMap[aircraft.icao24] = {
            ...aircraft,
            lastSeen: Date.now(),
          };
        }
      });

      // Merge with existing data to preserve fields that might not be in the new response
      setAircraftMap((currentMap) =>
        mergeAircraftData(currentMap, newAircraftMap)
      );
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Error fetching aircraft data:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint]);

  // Set up polling for fresh data
  useEffect(() => {
    if (initialLoad) {
      fetchAircraftData();
    }

    const intervalId = setInterval(() => {
      fetchAircraftData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchAircraftData, refreshInterval, initialLoad]);

  // Get a single aircraft by ICAO24
  const getAircraft = useCallback(
    (icao24: string) => {
      return aircraftMap[icao24] || null;
    },
    [aircraftMap]
  );

  // Update a single aircraft
  const updateAircraft = useCallback(
    (icao24: string, data: Partial<Aircraft & Record<string, any>>) => {
      setAircraftMap((current) => ({
        ...current,
        [icao24]: {
          ...current[icao24],
          ...data,
          lastUpdated: Date.now(),
        },
      }));
    },
    []
  );

  return {
    aircraftMap,
    isLoading,
    error,
    lastUpdated,
    fetchAircraftData,
    getAircraft,
    updateAircraft,
  };
}

export default useAircraftData;
