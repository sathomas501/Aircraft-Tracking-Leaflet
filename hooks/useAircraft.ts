import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SelectOption, Aircraft } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-models';
import { aircraftTrackingClient } from './useAircraftTracking';
import { icao24CacheService } from '../lib/services/icao24Cache';

// Global shared request cache for deduplication
const inFlightRequests = new Map<string, Promise<any>>();
const manufacturersCache: { data: SelectOption[]; timestamp: number } = {
  data: [],
  timestamp: 0,
};
const modelsCache: Record<
  string,
  { models: AircraftModel[]; timestamp: number }
> = {};

// Cache durations
const MANUFACTURERS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MODELS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
const POLLING_INTERVAL = 30 * 1000; // 30 seconds

interface UseAircraftOptions {
  initialManufacturer?: string | null;
  initialModel?: string | null;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  pollInterval?: number;
  autoPolling?: boolean; // Whether to automatically poll or rely on manual refreshes
}

export function useAircraft({
  initialManufacturer = null,
  initialModel = null,
  onStatusChange = () => {},
  onError = () => {},
  pollInterval = POLLING_INTERVAL,
  autoPolling = false, // Default to manual refreshes
}: UseAircraftOptions = {}) {
  // Processing flags to prevent circular loops
  const isProcessingRef = useRef(false);

  // Selection state
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(initialManufacturer);
  const [selectedModel, setSelectedModel] = useState<string | null>(
    initialModel
  );

  // Data state
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<AircraftModel[]>([]);
  const [liveModels, setLiveModels] = useState<AircraftModel[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // References for cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cleanupTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const subscriptionRef = useRef<(() => void) | null>(null);
  const prevLiveModelsRef = useRef<AircraftModel[]>([]);
  const prevModelsRef = useRef<AircraftModel[]>([]);
  const prevAircraftRef = useRef<Aircraft[]>([]);

  // Helper to update status messages
  const updateStatus = useCallback(
    (message: string) => {
      setStatusMessage(message);
      onStatusChange(message);
    },
    [onStatusChange]
  );

  // Helper to handle errors
  const handleError = useCallback(
    (errorMessage: string, errorObject?: any) => {
      console.error(`[useAircraft] ${errorMessage}`, errorObject);
      setError(errorMessage);
      onError(errorMessage);
    },
    [onError]
  );

  // Request deduplication helper
  const dedupedRequest = useCallback(
    async <T>(
      key: string,
      requestFn: () => Promise<T>,
      cacheTime: number = 2000
    ): Promise<T> => {
      // Check if this request is already in flight
      if (inFlightRequests.has(key)) {
        console.log(`[Dedup] ♻️ Reusing in-flight request: ${key}`);
        return inFlightRequests.get(key) as Promise<T>;
      }

      // Clear any existing cleanup timeout
      if (cleanupTimeoutsRef.current.has(key)) {
        clearTimeout(cleanupTimeoutsRef.current.get(key)!);
        cleanupTimeoutsRef.current.delete(key);
      }

      // Create and store the request promise
      console.log(`[Dedup] 🚀 Starting new request: ${key}`);
      const requestPromise = requestFn();
      inFlightRequests.set(key, requestPromise);

      try {
        // Wait for the request to complete
        const result = await requestPromise;

        // Set a timeout to remove this request from the cache
        const timeoutId = setTimeout(() => {
          console.log(`[Dedup] 🧹 Cleaning up request: ${key}`);
          inFlightRequests.delete(key);
          cleanupTimeoutsRef.current.delete(key);
        }, cacheTime);

        cleanupTimeoutsRef.current.set(key, timeoutId);

        return result;
      } catch (error) {
        // Remove failed requests immediately
        console.log(`[Dedup] ❌ Request failed: ${key}`);
        inFlightRequests.delete(key);
        throw error;
      }
    },
    []
  );

  // Cleanup function for timeouts and intervals
  const cleanup = useCallback(() => {
    // Clean up polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Clean up abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clean up request deduplication timeouts
    cleanupTimeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    cleanupTimeoutsRef.current.clear();

    // Clean up subscription
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }
  }, []);

  // Calculate merged models without updating state
  const calculateMergedModels = useCallback(() => {
    // Create a map of models by model name
    const modelMap = new Map<string, AircraftModel>();

    // First add all static models
    models.forEach((model) => {
      modelMap.set(model.model, { ...model });
    });

    // Then update with live data
    liveModels.forEach((liveModel) => {
      const existing = modelMap.get(liveModel.model);

      if (existing) {
        // Update existing model with live data
        modelMap.set(liveModel.model, {
          ...existing,
          activeCount: liveModel.activeCount || 0,
          label: `${liveModel.model} (${liveModel.activeCount || 0} active of ${existing.totalCount || existing.count || 0})`,
        });
      } else {
        // Add new live model
        modelMap.set(liveModel.model, liveModel);
      }
    });

    // Convert back to array and sort
    return Array.from(modelMap.values()).sort((a, b) => {
      // Sort by active count first (descending)
      const activeCountDiff = (b.activeCount || 0) - (a.activeCount || 0);
      if (activeCountDiff !== 0) return activeCountDiff;

      // Then by total count (descending)
      const totalCountDiff =
        (b.totalCount || b.count || 0) - (a.totalCount || a.count || 0);
      if (totalCountDiff !== 0) return totalCountDiff;

      // Finally by name (alphabetical)
      return a.model.localeCompare(b.model);
    });
  }, [models, liveModels]);

  // Update models state safely
  const updateModels = useCallback(() => {
    // Skip if we're already processing to prevent loops
    if (isProcessingRef.current) {
      return;
    }

    try {
      isProcessingRef.current = true;

      const mergedModels = calculateMergedModels();

      // Only update state if the models actually changed
      const currentJson = JSON.stringify(prevModelsRef.current);
      const newJson = JSON.stringify(mergedModels);

      if (currentJson !== newJson) {
        prevModelsRef.current = mergedModels;
        setModels(mergedModels);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [calculateMergedModels]);

  // 5. Process aircraft data into models
  const processAircraftModels = useCallback(
    (aircraftData: Aircraft[]) => {
      // Skip if we're already processing to prevent loops
      if (isProcessingRef.current) {
        return;
      }

      try {
        isProcessingRef.current = true;

        if (!aircraftData.length) {
          // Only update if there's an actual change
          if (prevLiveModelsRef.current.length > 0) {
            prevLiveModelsRef.current = [];
            setLiveModels([]);
          }
          return;
        }

        const modelMap = new Map<string, AircraftModel>();

        aircraftData.forEach((aircraft: Aircraft) => {
          const modelName =
            aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown';
          if (!modelName) return;

          const key = `${aircraft.manufacturer}-${modelName}`;
          const existing = modelMap.get(key);

          if (existing) {
            existing.count = (existing.count || 0) + 1;
            existing.activeCount =
              (existing.activeCount || 0) + (aircraft.isTracked ? 1 : 0);
            existing.totalCount = (existing.totalCount || 0) + 1;
          } else {
            modelMap.set(key, {
              model: modelName,
              manufacturer: aircraft.manufacturer || selectedManufacturer || '',
              label: `${modelName} (${aircraft.isTracked ? 'active' : 'inactive'})`,
              count: 1,
              activeCount: aircraft.isTracked ? 1 : 0,
              totalCount: 1,
            });
          }
        });

        // Convert to array and sort by active count (most active first)
        const liveModelsArray = Array.from(modelMap.values()).sort(
          (a, b) => (b.activeCount || 0) - (a.activeCount || 0)
        );

        // Update labels with counts
        liveModelsArray.forEach((model) => {
          model.label = `${model.model} (${model.activeCount || 0} active)`;
        });

        // Only update state if something changed
        const currentJson = JSON.stringify(prevLiveModelsRef.current);
        const newJson = JSON.stringify(liveModelsArray);

        if (currentJson !== newJson) {
          prevLiveModelsRef.current = liveModelsArray;
          setLiveModels(liveModelsArray);
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [selectedManufacturer]
  );

  // 1. Fetch manufacturers
  const fetchManufacturers = useCallback(async () => {
    // Check cache first
    if (
      manufacturersCache.data.length > 0 &&
      Date.now() - manufacturersCache.timestamp < MANUFACTURERS_CACHE_DURATION
    ) {
      setManufacturers(manufacturersCache.data);
      return manufacturersCache.data;
    }

    setIsLoading(true);
    updateStatus('Loading manufacturers...');

    try {
      const response = await dedupedRequest('POST-manufacturers', async () => {
        const res = await fetch('/api/aircraft/manufacturers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok)
          throw new Error(`Failed to fetch manufacturers: ${res.statusText}`);
        return res.json();
      });

      const manufacturerList = response.manufacturers || [];

      // Update cache
      manufacturersCache.data = manufacturerList;
      manufacturersCache.timestamp = Date.now();

      setManufacturers(manufacturerList);
      updateStatus(`Loaded ${manufacturerList.length} manufacturers`);
      return manufacturerList;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to load manufacturers';
      handleError(errorMsg, err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [updateStatus, handleError, dedupedRequest]);

  // 2. Fetch models for a manufacturer
  const fetchModels = useCallback(
    async (manufacturer: string | null) => {
      if (!manufacturer) {
        setModels([]);
        return [];
      }

      // Check cache first
      if (
        modelsCache[manufacturer] &&
        Date.now() - modelsCache[manufacturer].timestamp < MODELS_CACHE_DURATION
      ) {
        setModels(modelsCache[manufacturer].models);
        return modelsCache[manufacturer].models;
      }

      setIsLoading(true);
      updateStatus(`Loading models for ${manufacturer}...`);

      try {
        const response = await dedupedRequest(
          `POST-models-${manufacturer}`, // Updated key for clarity
          async () => {
            const res = await fetch('/api/aircraft/models', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manufacturer }),
            });

            if (!res.ok)
              throw new Error(`Failed to fetch models: ${res.statusText}`);
            return res.json();
          }
        );

        const modelList = response.models || [];

        // Process models to ensure consistent format
        const processedModels = modelList.map((model: any) => ({
          model: model.model || '',
          manufacturer: model.manufacturer || manufacturer,
          activeCount: 0, // Will be updated when we get aircraft data
          count: model.count || 0,
          totalCount: model.totalCount || model.count || 0,
        }));

        // Update cache
        modelsCache[manufacturer] = {
          models: processedModels,
          timestamp: Date.now(),
        };

        setModels(processedModels);
        // Store in ref for comparison
        prevModelsRef.current = processedModels;

        updateStatus(`Loaded ${processedModels.length} models`);
        return processedModels;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to load models';
        handleError(errorMsg, err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [updateStatus, handleError, dedupedRequest]
  );

  // 4. Fetch live positions from OpenSky
  const fetchLivePositions = useCallback(
    async (manufacturer: string) => {
      if (!manufacturer) return;

      try {
        // Get ICAO24s from cache service
        const icaos = await icao24CacheService.getIcao24s(manufacturer);

        if (!icaos.length) {
          updateStatus('No aircraft identifiers found');
          return;
        }

        updateStatus(`Fetching live positions for ${icaos.length} aircraft...`);

        // Call the API to get real-time data
        const response = await fetch('/api/aircraft/icaofetcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s: icaos }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch from OpenSky: ${response.statusText}`
          );
        }

        const data = await response.json();

        if (data.success && data.data) {
          const aircraftData = data.data;

          // Only update if data actually changed
          const currentJson = JSON.stringify(prevAircraftRef.current);
          const newJson = JSON.stringify(aircraftData);

          if (currentJson !== newJson) {
            prevAircraftRef.current = aircraftData;
            setAircraft(aircraftData);
            updateStatus(`Tracking ${aircraftData.length} live aircraft`);

            // Process live model data
            processAircraftModels(aircraftData);
          }
        } else {
          updateStatus('No live aircraft found in OpenSky');
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Error connecting to OpenSky';
        handleError(errorMsg, err);
      }
    },
    [updateStatus, handleError, processAircraftModels]
  );

  // 6. Start polling for live position updates (if autoPolling is enabled)
  const startPolling = useCallback(
    (manufacturer: string) => {
      if (!manufacturer || !autoPolling) return;

      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      console.log(`[useAircraft] Starting polling for ${manufacturer}`);

      // Set up new polling
      const interval = setInterval(() => {
        fetchLivePositions(manufacturer);
      }, pollInterval);

      pollingIntervalRef.current = interval;
    },
    [fetchLivePositions, pollInterval, autoPolling]
  );

  // 3. Fetch and track live aircraft via OpenSky
  const startTrackingAircraft = useCallback(
    async (manufacturer: string) => {
      if (!manufacturer) return;

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      updateStatus('Initializing tracking...');

      try {
        // Initialize tracking via API
        const trackResult = await dedupedRequest(
          `track-init-${manufacturer}`,
          async () => {
            const response = await fetch('/api/aircraft/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manufacturer }),
              signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
              throw new Error(
                `Failed to initialize tracking: ${response.statusText}`
              );
            }

            return response.json();
          }
        );

        if (trackResult.count > 0) {
          updateStatus(
            `Initialized tracking for ${trackResult.count} aircraft`
          );

          // Fetch live positions
          await fetchLivePositions(manufacturer);

          // Start polling
          startPolling(manufacturer);
        } else {
          updateStatus('No aircraft available for tracking');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('[useAircraft] Request aborted');
          return;
        }

        const errorMsg =
          err instanceof Error ? err.message : 'Failed to initialize tracking';
        handleError(errorMsg, err);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      updateStatus,
      handleError,
      dedupedRequest,
      fetchLivePositions,
      startPolling,
    ]
  );

  // 7. Subscribe to tracked aircraft client
  const subscribeToClient = useCallback(
    (manufacturer: string | null) => {
      // Unsubscribe from previous updates
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }

      if (!manufacturer) return;

      // Subscribe to the tracking client
      subscriptionRef.current = aircraftTrackingClient.subscribe(
        manufacturer,
        (updatedAircraft) => {
          // Only update if data actually changed
          const currentJson = JSON.stringify(prevAircraftRef.current);
          const newJson = JSON.stringify(updatedAircraft);

          if (currentJson !== newJson) {
            prevAircraftRef.current = updatedAircraft;
            setAircraft(updatedAircraft);
            updateStatus(`Tracking ${updatedAircraft.length} aircraft`);

            // Process aircraft into models
            processAircraftModels(updatedAircraft);
          }
        }
      );
    },
    [updateStatus, processAircraftModels]
  );

  // 9. Handle manufacturer selection
  const selectManufacturer = useCallback(
    async (manufacturer: string | null) => {
      if (manufacturer === selectedManufacturer) return;

      // Clean up previous tracking
      cleanup();

      setSelectedManufacturer(manufacturer);
      setSelectedModel(null);

      if (!manufacturer) {
        setModels([]);
        setLiveModels([]);
        setAircraft([]);
        updateStatus('');
        return;
      }

      try {
        setIsLoading(true);
        updateStatus(`Loading data for ${manufacturer}...`);

        // Reset state to prevent stale data issues
        prevLiveModelsRef.current = [];
        prevModelsRef.current = [];
        prevAircraftRef.current = [];

        // Load static model data first
        await fetchModels(manufacturer);

        // Then start tracking
        await startTrackingAircraft(manufacturer);

        // Also subscribe to tracked aircraft client
        subscribeToClient(manufacturer);
      } catch (error) {
        console.error('Error selecting manufacturer:', error);
        handleError('Failed to select manufacturer');
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedManufacturer,
      cleanup,
      fetchModels,
      startTrackingAircraft,
      subscribeToClient,
      updateStatus,
      handleError,
    ]
  );

  // 10. Handle model selection
  const selectModel = useCallback(
    (model: string | null) => {
      setSelectedModel(model);
      updateStatus(model ? `Selected model: ${model}` : 'All models selected');
    },
    [updateStatus]
  );

  // 11. Reset all selections
  const reset = useCallback(() => {
    cleanup();
    setSelectedManufacturer(null);
    setSelectedModel(null);
    setModels([]);
    setLiveModels([]);
    setAircraft([]);
    updateStatus('Selection reset');
  }, [cleanup, updateStatus]);

  // 12. Filter aircraft by selected model
  const filteredAircraft = useMemo(() => {
    if (!selectedModel) return aircraft;

    return aircraft.filter(
      (aircraft) =>
        aircraft.model === selectedModel ||
        aircraft.TYPE_AIRCRAFT === selectedModel
    );
  }, [aircraft, selectedModel]);

  // Effect: Update models when either static or live models change
  useEffect(() => {
    updateModels();
  }, [liveModels, updateModels]);

  // Effect: Load manufacturers on initial mount
  useEffect(() => {
    fetchManufacturers();

    // Clean up on unmount
    return cleanup;
  }, [fetchManufacturers, cleanup]);

  // Effect: Load initial manufacturer and model if provided
  useEffect(() => {
    if (initialManufacturer && initialManufacturer !== selectedManufacturer) {
      selectManufacturer(initialManufacturer);
    }
  }, [initialManufacturer, selectedManufacturer, selectManufacturer]);

  // Computed values
  const totalActiveAircraft = useMemo(() => aircraft.length, [aircraft]);
  const totalFilteredAircraft = useMemo(
    () => filteredAircraft.length,
    [filteredAircraft]
  );
  const totalActiveModels = useMemo(
    () => models.filter((model) => (model.activeCount || 0) > 0).length,
    [models]
  );

  // Last refresh timestamp
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const manualRefresh = useCallback(async () => {
    try {
      console.log('[AircraftSelector] 🔄 Manual refresh triggered...');

      if (!selectedManufacturer) {
        console.log('[AircraftSelector] 🔄 Refreshing manufacturers...');
        await fetchManufacturers();
      } else {
        console.log(
          `[AircraftSelector] 🔄 Refreshing positions for: ${selectedManufacturer}`
        );
        await fetchLivePositions(selectedManufacturer);
      }

      setLastRefreshed(new Date());
      console.log(
        `[AircraftSelector] ✅ Last refreshed at: ${new Date().toLocaleTimeString()}`
      );
    } catch (error) {
      console.error('[AircraftSelector] ❌ Manual refresh failed:', error);
    }
  }, [selectedManufacturer, fetchManufacturers, fetchLivePositions]);

  return {
    // State
    manufacturers,
    models,
    aircraft: filteredAircraft,
    allAircraft: aircraft,
    selectedManufacturer,
    selectedModel,

    // UI state
    isLoading,
    statusMessage,
    error,
    lastRefreshed,

    // Actions
    selectManufacturer,
    selectModel,
    reset,
    refreshManufacturers: fetchManufacturers,
    refreshModels: () => fetchModels(selectedManufacturer),
    refreshAircraft: manualRefresh,

    // Controls for polling
    startPolling: () => {
      if (selectedManufacturer) {
        startPolling(selectedManufacturer);
      }
    },
    stopPolling: cleanup,

    // Stats
    totalActiveAircraft,
    totalFilteredAircraft,
    totalActiveModels,
    totalModels: models.length,
  };
}
