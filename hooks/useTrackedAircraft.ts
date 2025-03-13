// lib/hooks/useTrackedAircraft.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Aircraft } from '@/types/base';

/**
 * Hook for accessing tracked aircraft data from the client
 * Updated to work with the new tracking services
 */
export function useTrackedAircraft(manufacturer: string | null) {
  const [trackedAircraft, setTrackedAircraft] = useState<Aircraft[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<string>('initializing');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Function to load aircraft data
  const loadAircraft = useCallback(async () => {
    if (!manufacturer) {
      setTrackedAircraft([]);
      setTrackingStatus('idle');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setTrackingStatus('loading');

      // Use the API directly to avoid any fs-related issues
      const response = await fetch(
        `/api/tracking?action=tracked-aircraft&manufacturer=${encodeURIComponent(manufacturer)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to load aircraft');
      }

      const aircraft = data.data?.aircraft || [];

      setTrackedAircraft(aircraft);
      setTrackingStatus(aircraft.length > 0 ? 'active' : 'no-data');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTrackingStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [manufacturer]);

  // Start tracking for a manufacturer
  const startTracking = useCallback(async () => {
    if (!manufacturer) return;

    try {
      setTrackingStatus('syncing');

      // Call the API directly
      const response = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncManufacturer',
          manufacturer,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to sync aircraft');
      }

      // Reload aircraft after sync
      await loadAircraft();

      // Start polling for updates if not already polling
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          loadAircraft();
        }, 30000); // Poll every 30 seconds
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTrackingStatus('error');
    }
  }, [manufacturer, loadAircraft]);

  // Stop tracking for a manufacturer
  const stopTracking = useCallback(() => {
    if (!manufacturer) return;

    // Stop polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Call the API to stop tracking
    fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'stopTracking',
        manufacturer,
      }),
    }).catch((err) => {
      console.error('Error stopping tracking:', err);
    });

    setTrackingStatus('stopped');
  }, [manufacturer]);

  // Effect to load aircraft when manufacturer changes
  useEffect(() => {
    if (manufacturer) {
      loadAircraft();
    } else {
      setTrackedAircraft([]);
      setTrackingStatus('idle');

      // Stop polling if we were polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [manufacturer, loadAircraft]);

  // Extract models from aircraft
  const aircraftModels = trackedAircraft.reduce(
    (models, aircraft) => {
      if (!aircraft.model) return models;

      const existing = models.find((m) => m.model === aircraft.model);

      if (existing) {
        existing.activeCount = (existing.activeCount || 0) + 1;
      } else {
        models.push({
          model: aircraft.model,
          manufacturer: aircraft.manufacturer || '',
          label: aircraft.model,
          activeCount: 1,
          count: 1,
        });
      }

      return models;
    },
    [] as Array<{
      model: string;
      manufacturer: string;
      label: string;
      activeCount: number;
      count: number;
    }>
  );

  return {
    trackedAircraft,
    aircraftModels,
    isInitializing: isLoading,
    trackingStatus,
    error,
    loadAircraft,
    startTracking,
    stopTracking,
  };
}

/**
 * Compatibility layer for useOpenSkyData
 * Now properly forwards to useTrackedAircraft
 */
export function useOpenSkyData(manufacturer: string | null) {
  const {
    trackedAircraft,
    aircraftModels,
    isInitializing,
    trackingStatus,
    error,
    loadAircraft,
    startTracking,
  } = useTrackedAircraft(manufacturer);

  return {
    trackedAircraft,
    aircraftModels,
    isInitializing,
    trackingStatus,
    error,
    refreshStatus: loadAircraft,
  };
}
