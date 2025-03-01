// lib/hooks/useTrackedAircraft.ts
import { useState, useEffect, useCallback } from 'react';
import { Aircraft } from '@/types/base';

/**
 * Hook for accessing tracked aircraft data from the client
 * Compatible with existing useOpenSkyData pattern
 */
export function useTrackedAircraft(manufacturer: string | null) {
  const [trackedAircraft, setTrackedAircraft] = useState<Aircraft[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<string>('initializing');

  // Initial load
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

      setTrackedAircraft(data.data?.aircraft || []);
      setTrackingStatus(data.data?.aircraft?.length > 0 ? 'active' : 'no-data');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTrackingStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [manufacturer]);

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!manufacturer) return;

    try {
      setTrackingStatus('syncing');

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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTrackingStatus('error');
    }
  }, [manufacturer, loadAircraft]);

  // Effect to load aircraft when manufacturer changes
  useEffect(() => {
    if (manufacturer) {
      loadAircraft();
    } else {
      setTrackedAircraft([]);
      setTrackingStatus('idle');
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
  };
}

// Compatibility layer for useOpenSkyData
export function useOpenSkyData(manufacturer: string | null) {
  return useTrackedAircraft(manufacturer);
}
