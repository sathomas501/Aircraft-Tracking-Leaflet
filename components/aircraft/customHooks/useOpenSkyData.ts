import { useState, useEffect, useCallback, useRef } from 'react';
import { Aircraft } from '@/types/base';
import { AircraftModel } from '../../../types/aircraft-models';
import { useRequestDeduplication } from './useRequestDeduplication';

/**
 * Frontend-safe hook to handle OpenSky data integration via API routes
 */
export function useOpenSkyData(manufacturer: string | null) {
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [trackingStatus, setTrackingStatus] = useState<string>('');
  const [trackedAircraft, setTrackedAircraft] = useState<Aircraft[]>([]);
  const [aircraftModels, setAircraftModels] = useState<AircraftModel[]>([]); // ✅ Add this
  const [icao24s, setIcao24s] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, string[]>>(new Map()); // ✅ Store ICAO24s per manufacturer
  const pendingRequests = useRef<Map<string, Promise<string[]>>>(new Map());

  // Get the deduplication hook
  const { dedupedRequest } = useRequestDeduplication();

  /**
   * Fetch ICAO24s for a manufacturer via API (Centrally Managed)
   */
  const fetchIcao24s = useCallback(async (manuf: string): Promise<string[]> => {
    if (!manuf) return [];

    // ✅ Step 1: Check cache first
    if (cacheRef.current.has(manuf)) {
      console.log(`[OpenSkyHook] ✅ Using cached ICAO24s for ${manuf}`);
      return cacheRef.current.get(manuf) || [];
    }

    // ✅ Step 2: Check if a request is already pending
    if (pendingRequests.current.has(manuf)) {
      console.log(`[OpenSkyHook] 🚧 Waiting for ongoing ICAO24s request...`);
      return pendingRequests.current.get(manuf)!;
    }

    // ✅ Step 3: Fetch ICAO24s from API (only if no cache exists)
    console.log(`[OpenSkyHook] 🔄 Fetching ICAO24s for ${manuf}`);

    const fetchPromise = fetch('/api/aircraft/icao24s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer: manuf }),
    })
      .then(async (response) => {
        if (!response.ok) {
          console.error(
            `[OpenSkyHook] ❌ Failed to fetch ICAO codes: ${response.statusText}`
          );
          return [];
        }

        const data = await response.json();
        const icaoList = data?.data?.icao24List ?? [];

        // ✅ Step 4: Cache the response for future calls
        cacheRef.current.set(manuf, icaoList);
        return icaoList;
      })
      .catch((error) => {
        console.error(`[OpenSkyHook] ❌ Failed to fetch ICAO24s:`, error);
        return [];
      })
      .finally(() => {
        pendingRequests.current.delete(manuf); // ✅ Cleanup pending request
      });

    // ✅ Store the request to prevent duplicate fetches
    pendingRequests.current.set(manuf, fetchPromise);

    return fetchPromise;
  }, []);

  /**
   * Start tracking aircraft data from OpenSky
   */
  const startTracking = useCallback(async () => {
    if (!manufacturer) {
      setTrackingStatus('');
      setTrackedAircraft([]);
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // ✅ Step 1: Fetch ICAO24s first (deduplicated + cached)
      const fetchedIcao24s = await fetchIcao24s(manufacturer);

      if (fetchedIcao24s.length === 0) {
        setTrackingStatus('No aircraft found for this manufacturer');
        setIsInitializing(false);
        return;
      }

      // ✅ Step 2: Use ICAO24s to fetch live tracking data from OpenSky
      console.log(
        `[OpenSkyHook] 🚀 Fetching live OpenSky data for ${fetchedIcao24s.length} ICAOs`
      );

      const response = await fetch('/api/aircraft/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s: fetchedIcao24s }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch aircraft tracking data: ${response.statusText}`
        );
      }

      const data = await response.json();
      setTrackedAircraft(data.aircraft || []);
      setTrackingStatus(`Tracking ${data.aircraft?.length || 0} aircraft`);
    } catch (err) {
      console.error(`[OpenSkyHook] ❌ Error starting tracking:`, err);
      setError(
        err instanceof Error ? err : new Error('Failed to start tracking')
      );
      setTrackingStatus('Error connecting to OpenSky');
    } finally {
      setIsInitializing(false);
    }
  }, [manufacturer, fetchIcao24s]);

  return {
    isInitializing,
    trackingStatus,
    trackedAircraft,
    aircraftModels, // ✅ Add this to the return object
    error,
    startTracking, // 🔥 Now handles ICAO24s and tracking in one call
  };
}
