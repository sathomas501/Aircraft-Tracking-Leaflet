import { useState, useEffect, useCallback, useRef } from 'react';
import { Aircraft } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-types';
import { OpenSkySyncService } from '@/lib/services/openSkySyncService';
import { useRequestDeduplication } from './useRequestDeduplication';

/**
 * Frontend-safe hook to handle OpenSky data integration via API routes
 */
export function useOpenSkyData(manufacturer: string | null) {
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [trackingStatus, setTrackingStatus] = useState<string>('');
  const [trackedAircraft, setTrackedAircraft] = useState<Aircraft[]>([]);
  const [aircraftModels, setAircraftModels] = useState<AircraftModel[]>([]);
  const [icao24s, setIcao24s] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Get the deduplication hook
  const { dedupedRequest, cleanup } = useRequestDeduplication();

  /**
   * Fetch ICAO24s for a manufacturer via API
   */
  const fetchIcao24s = useCallback(
    async (manuf: string): Promise<string[]> => {
      if (!manuf) return [];

      try {
        // Use deduplication with a unique key
        const key = `ICAO24s-${manuf}`;
        const data = await dedupedRequest(key, async () => {
          console.log(`[OpenSkyHook] 🔄 Fetching ICAO24s for ${manuf}`);
          const response = await fetch('/api/aircraft/icao24s', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manufacturer: manuf }),
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch ICAO24s for ${manuf}`);
          }

          return response.json();
        });

        const fetchedIcao24s =
          data.success && data.data?.icao24List ? data.data.icao24List : [];
        console.log(
          `[OpenSkyHook] ✅ Received ${fetchedIcao24s.length} ICAO24s`
        );
        setIcao24s(fetchedIcao24s);
        return fetchedIcao24s;
      } catch (error) {
        console.error(`[OpenSkyHook] ❌ Error fetching ICAO24s:`, error);
        return [];
      }
    },
    [dedupedRequest]
  );

  /**
   * Fetch tracking data from API with deduplication
   */
  const fetchTrackingData = useCallback(
    async (manuf: string) => {
      if (!manuf) return;

      try {
        // Use deduplication with a unique key
        const key = `TrackingData-${manuf}`;
        const status = await dedupedRequest(key, async () => {
          console.log(`[OpenSkyHook] 🔄 Fetching tracking data for ${manuf}`);
          const response = await fetch(
            `/api/tracking/tracked?manufacturer=${encodeURIComponent(manuf)}`
          );

          if (!response.ok) {
            throw new Error(
              `Failed to get tracking status: ${response.statusText}`
            );
          }

          return response.json();
        });

        if (status.data && status.data.length > 0) {
          console.log(
            `[OpenSkyHook] ✅ Received data for ${status.data.length} aircraft`
          );
          setTrackingStatus(`Tracking ${status.data.length} aircraft`);
          setTrackedAircraft(status.data);

          // Process model data
          const modelMap = new Map<string, AircraftModel>();
          status.data.forEach((aircraft: Aircraft) => {
            const modelName =
              aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown';
            if (!modelName) return;

            const key = `${aircraft.manufacturer}-${modelName}`;
            const existing = modelMap.get(key);

            if (existing) {
              existing.count++;
              if (aircraft.isTracked) existing.activeCount++;
              existing.totalCount++;
              if (existing.icao24s && aircraft.icao24)
                existing.icao24s.push(aircraft.icao24);
            } else {
              modelMap.set(key, {
                model: modelName,
                manufacturer: aircraft.manufacturer,
                label: `${modelName} (active)`,
                count: 1,
                activeCount: aircraft.isTracked ? 1 : 0,
                totalCount: 1,
                icao24s: [aircraft.icao24],
              });
            }
          });

          setAircraftModels(Array.from(modelMap.values()));
        } else {
          setTrackingStatus('Waiting for aircraft data...');
        }
      } catch (err) {
        console.error('[OpenSkyHook] ❌ Error checking tracking status:', err);
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to check tracking status')
        );
      }
    },
    [dedupedRequest]
  );

  /**
   * Initialize tracking for a manufacturer
   */
  const startTracking = useCallback(async () => {
    if (!manufacturer) {
      setTrackingStatus('');
      setTrackedAircraft([]);
      return;
    }

    // Abort any previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    setIsInitializing(true);
    setError(null);

    try {
      // Step 1: Fetch ICAO24s first
      console.log(`[OpenSkyHook] 🔄 Fetching ICAO24s for ${manufacturer}`);
      setTrackingStatus('Fetching aircraft identifiers...');

      const fetchedIcao24s = await fetchIcao24s(manufacturer);

      if (fetchedIcao24s.length === 0) {
        setTrackingStatus('No aircraft found for this manufacturer');
        setIsInitializing(false);
        return;
      }

      // Step 2: Initialize tracking via API with deduplication
      console.log(`[OpenSkyHook] 🚀 Initializing tracking for ${manufacturer}`);
      setTrackingStatus(
        `Initializing tracking for ${fetchedIcao24s.length} aircraft...`
      );

      const key = `InitTracking-${manufacturer}`;
      const trackResult = await dedupedRequest(key, async () => {
        const response = await fetch('/api/aircraft/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ manufacturer }),
          signal: abortController.current?.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to initialize tracking: ${response.statusText}`
          );
        }

        return response.json();
      });

      if (trackResult.count > 0) {
        console.log(
          `[OpenSkyHook] ✅ Initialized tracking for ${trackResult.count} aircraft`
        );
        setTrackingStatus(
          `Initialized tracking for ${trackResult.count} aircraft`
        );

        // Fetch initial tracking data
        await fetchTrackingData(manufacturer);

        // Start polling for status updates
        startPolling();
      } else {
        setTrackingStatus('No aircraft available for tracking');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('[OpenSkyHook] 🚫 Request aborted');
        return;
      }

      console.error('[OpenSkyHook] ❌ Error initializing tracking:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to initialize tracking')
      );
      setTrackingStatus('Error initializing tracking');
    } finally {
      setIsInitializing(false);
      abortController.current = null;
    }
  }, [manufacturer, fetchIcao24s, dedupedRequest, fetchTrackingData]);

  /**
   * Start polling for tracking status updates
   */
  const startPolling = useCallback(() => {
    if (!manufacturer) return;

    // Clear any existing polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    console.log(`[OpenSkyHook] 🔄 Starting polling for ${manufacturer}`);

    // Set up new polling
    const interval = setInterval(() => {
      fetchTrackingData(manufacturer);
    }, 10000); // Poll every 10 seconds

    pollingInterval.current = interval;

    // Initial fetch
    fetchTrackingData(manufacturer);
  }, [manufacturer, fetchTrackingData]);

  /**
   * Stop polling for updates
   */
  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      console.log('[OpenSkyHook] Stopping polling');
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  /**
   * Clean up resources on unmount or manufacturer change
   */
  useEffect(() => {
    return () => {
      stopPolling();
      cleanup();
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [stopPolling, cleanup]);

  /**
   * Start tracking when manufacturer changes
   */
  useEffect(() => {
    if (manufacturer) {
      startTracking();
    } else {
      stopPolling();
      setTrackingStatus('');
      setTrackedAircraft([]);
      setAircraftModels([]);
    }
  }, [manufacturer, startTracking, stopPolling]);

  return {
    isInitializing,
    trackingStatus,
    trackedAircraft,
    aircraftModels,
    error,
    refreshStatus: () => fetchTrackingData(manufacturer || ''),
  };
}
