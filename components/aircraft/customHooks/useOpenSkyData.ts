// useOpenSkyData.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Aircraft } from '@/types/base';
import { AircraftModel, ActiveModel } from '@/types/aircraft-types';
import { useRequestDeduplication } from './useRequestDeduplication';
import { icao24CacheService } from '@/lib/services/icao24Cache';

/**
 * Frontend-safe hook to handle OpenSky data integration via API routes
 */
export function useOpenSkyData(manufacturer: string | null) {
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [trackingStatus, setTrackingStatus] = useState<string>('');
  const [trackedAircraft, setTrackedAircraft] = useState<Aircraft[]>([]);
  const [aircraftModels, setAircraftModels] = useState<ActiveModel[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Get the deduplication hook
  const { dedupedRequest, cleanup } = useRequestDeduplication();

  /**
   * Fetch live positions from OpenSky
   */
  const fetchLivePositions = useCallback(async (manuf: string) => {
    if (!manuf) return;

    try {
      // Get ICAO24s from cache service
      const icaos = await icao24CacheService.getIcao24s(manuf);

      if (!icaos.length) {
        console.log('[OpenSkyHook] No ICAO24s found for tracking');
        setTrackingStatus('No aircraft identifiers found');
        return;
      }

      setTrackingStatus(
        `Fetching live positions for ${icaos.length} aircraft...`
      );

      // Call the icaofetcher endpoint to get real-time data
      const response = await fetch('/api/aircraft/icaofetcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s: icaos }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from OpenSky: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        console.log(
          `[OpenSkyHook] ✅ Received ${data.data.length} live positions from OpenSky`
        );
        setTrackedAircraft(data.data);
        setTrackingStatus(`Tracking ${data.data.length} live aircraft`);

        // Process model data
        processAircraftModels(data.data);
      } else {
        setTrackingStatus('No live aircraft found in OpenSky');
      }
    } catch (error) {
      console.error('[OpenSkyHook] ❌ Error fetching live positions:', error);
      setTrackingStatus('Error connecting to OpenSky');
      setError(
        error instanceof Error
          ? error
          : new Error('Failed to fetch from OpenSky')
      );
    }
  }, []);

  /**
   * Process aircraft data into models
   */
  const processAircraftModels = useCallback(
    (aircraft: Aircraft[]) => {
      if (!aircraft.length) return;

      const modelMap = new Map<string, ActiveModel>();

      aircraft.forEach((aircraft: Aircraft) => {
        const modelName = aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown';
        if (!modelName) return;

        const key = `${aircraft.manufacturer}-${modelName}`;
        const existing = modelMap.get(key);

        if (existing) {
          existing.activeCount++;
          if (existing.icao24s && aircraft.icao24) {
            existing.icao24s.push(aircraft.icao24);
          }
        } else {
          modelMap.set(key, {
            model: modelName,
            manufacturer: aircraft.manufacturer || manufacturer || '',
            label: `${modelName} (${aircraft.isTracked ? 'active' : 'inactive'})`,
            activeCount: aircraft.isTracked ? 1 : 0,
            totalCount: 1,
            icao24s: aircraft.icao24 ? [aircraft.icao24] : [],
          });
        }
      });

      // Convert to array and sort by active count (most active first)
      const models = Array.from(modelMap.values()).sort(
        (a, b) => b.activeCount - a.activeCount
      );

      // Update label with counts
      models.forEach((model) => {
        model.label = `${model.model} (${model.activeCount} active)`;
      });

      console.log(
        `[OpenSkyHook] Processed ${models.length} unique aircraft models`
      );
      setAircraftModels(models);
    },
    [manufacturer]
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
      // Step 1: Initialize tracking via API
      console.log(`[OpenSkyHook] 🚀 Initializing tracking for ${manufacturer}`);
      setTrackingStatus('Initializing tracking...');

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

        // Fetch live positions from OpenSky
        await fetchLivePositions(manufacturer);

        // Start polling
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
  }, [manufacturer, dedupedRequest, fetchLivePositions]);

  /**
   * Start polling for live position updates
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
      fetchLivePositions(manufacturer);
    }, 30000); // Poll every 30 seconds

    pollingInterval.current = interval;
  }, [manufacturer, fetchLivePositions]);

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
    refreshStatus: () => fetchLivePositions(manufacturer || ''),
  };
}
