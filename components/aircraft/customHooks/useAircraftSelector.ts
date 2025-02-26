import { useState, useCallback, useEffect, useMemo } from 'react';
import { Aircraft } from '@/types/base';
import { useOpenSkyData } from './useOpenSkyData';
import { fetchModels } from '../../aircraft/tracking/selector/services/aircraftService';
import { AircraftModel, SelectOption } from '@/types/aircraft-types';

// In-memory cache for models
const modelsCache: {
  [manufacturer: string]: { models: AircraftModel[]; timestamp: number };
} = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface UseAircraftSelectorProps {
  onModelsUpdate?: (models: AircraftModel[]) => void;
  onAircraftUpdate?: (aircraft: Aircraft[]) => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: string) => void;
}

export function useAircraftSelector({
  onModelsUpdate = () => {},
  onAircraftUpdate = () => {},
  onError = () => {},
  onStatusChange = () => {},
}: UseAircraftSelectorProps = {}) {
  // Selection state
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Data state
  const [staticModels, setStaticModels] = useState<AircraftModel[]>([]);
  const [mergedModels, setMergedModels] = useState<AircraftModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<Error | null>(null);

  // Connect to OpenSky data
  const {
    trackedAircraft,
    aircraftModels: liveModels,
    trackingStatus,
    isInitializing,
    error: trackingError,
  } = useOpenSkyData(selectedManufacturer);

  // Report errors and status changes to parent
  useEffect(() => {
    if (trackingError) {
      onError(trackingError.message);
    }
  }, [trackingError, onError]);

  useEffect(() => {
    onStatusChange(trackingStatus);
  }, [trackingStatus, onStatusChange]);

  useEffect(() => {
    onAircraftUpdate(trackedAircraft);
  }, [trackedAircraft, onAircraftUpdate]);

  // Load static models for the selected manufacturer
  const loadStaticModels = useCallback(
    async (manufacturer: string | null) => {
      if (!manufacturer) {
        setStaticModels([]);
        return [];
      }

      // Check cache first
      const cachedEntry = modelsCache[manufacturer];
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
        console.log(
          `[useAircraftSelector] Using cached models for ${manufacturer}`
        );
        setStaticModels(cachedEntry.models);
        return cachedEntry.models;
      }

      setIsLoadingModels(true);
      setModelError(null);

      try {
        console.log(
          `[useAircraftSelector] Fetching static models for ${manufacturer}`
        );
        const fetchedModels = await fetchModels(manufacturer);

        // Process models to ensure they're in the right format
        const processedModels: AircraftModel[] = fetchedModels.map((model) => ({
          model: model.model || '',
          manufacturer: model.manufacturer || manufacturer,
          label: `${model.model} (${model.count ?? 0} total)`,
          activeCount: 0, // Will be updated by mergeModels
          count: (model as any).count ?? 0,
          totalCount: (model as any).totalCount ?? (model as any).count ?? 0,
        }));

        // Cache the models
        modelsCache[manufacturer] = {
          models: processedModels,
          timestamp: Date.now(),
        };

        // Update state
        setStaticModels(processedModels);
        return processedModels;
      } catch (error) {
        console.error('[useAircraftSelector] Error fetching models:', error);
        setModelError(
          error instanceof Error ? error : new Error('Failed to load models')
        );
        onError('Failed to load aircraft models');
        return [];
      } finally {
        setIsLoadingModels(false);
      }
    },
    [onError]
  );

  // Merge static and live model data
  const mergeModels = useCallback(
    (static_models: AircraftModel[], live_models: AircraftModel[]) => {
      if (!static_models.length) return live_models;
      if (!live_models.length) return static_models;

      // Create a map to merge by model name
      const modelMap = new Map<string, AircraftModel>();

      // First, add all static models to the map
      static_models.forEach((model) => {
        modelMap.set(model.model, { ...model });
      });

      // Then, update with live data where available
      live_models.forEach((liveModel) => {
        const existing = modelMap.get(liveModel.model);
        if (existing) {
          modelMap.set(liveModel.model, {
            ...existing,
            activeCount: liveModel.activeCount || 0,
            label: `${liveModel.model} (${liveModel.activeCount || 0} active of ${existing.totalCount || existing.count || 0})`,
          });
        } else {
          // This is a live model not in our static database
          modelMap.set(liveModel.model, {
            ...liveModel,
            totalCount: liveModel.activeCount || 0,
            count: liveModel.activeCount || 0,
          });
        }
      });

      // Convert back to array and sort
      const merged = Array.from(modelMap.values()).sort((a, b) => {
        // Sort by active count first (descending)
        const activeCountDiff = (b.activeCount || 0) - (a.activeCount || 0);
        if (activeCountDiff !== 0) return activeCountDiff;

        // Then by total count (descending)
        const totalCountDiff =
          (b.totalCount || b.count || 0) - (a.totalCount || a.count || 0);
        if (totalCountDiff !== 0) return totalCountDiff;

        // Finally alphabetically
        return a.model.localeCompare(b.model);
      });

      return merged;
    },
    []
  );

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      setSelectedManufacturer(manufacturer);
      setSelectedModel(null); // Reset model selection

      // Load static models for the new manufacturer
      const models = await loadStaticModels(manufacturer);

      // Initial merge with empty live data
      const initialMerged = mergeModels(models, []);
      setMergedModels(initialMerged);
      onModelsUpdate(initialMerged);
    },
    [loadStaticModels, mergeModels, onModelsUpdate]
  );

  // Update merged models when either static or live models change
  useEffect(() => {
    const merged = mergeModels(staticModels, liveModels);
    setMergedModels(merged);
    onModelsUpdate(merged);

    // Format model labels based on live data status
    const hasLiveData = trackedAircraft.length > 0;
    console.log(
      `[useAircraftSelector] Merged ${staticModels.length} static and ${liveModels.length} live models. Has live data: ${hasLiveData}`
    );
  }, [
    staticModels,
    liveModels,
    mergeModels,
    onModelsUpdate,
    trackedAircraft.length,
  ]);

  // Handle model selection
  const handleModelSelect = useCallback((model: string | null) => {
    setSelectedModel(model);
  }, []);

  // Filter aircraft by selected model if one is selected
  const filteredAircraft = useMemo(() => {
    if (!selectedModel) return trackedAircraft;
    return trackedAircraft.filter(
      (aircraft) =>
        aircraft.model === selectedModel ||
        aircraft.TYPE_AIRCRAFT === selectedModel
    );
  }, [trackedAircraft, selectedModel]);

  // Keep parent updated with filtered aircraft
  useEffect(() => {
    onAircraftUpdate(filteredAircraft);
  }, [filteredAircraft, onAircraftUpdate]);

  return {
    // Selection state
    selectedManufacturer,
    selectedModel,

    // Data
    models: mergedModels,
    staticModelCount: staticModels.length,
    liveModelCount: liveModels.length,
    allAircraft: trackedAircraft,
    filteredAircraft,

    // Status
    isLoading: isLoadingModels || isInitializing,
    trackingStatus,
    error: trackingError || modelError,
    hasLiveData: trackedAircraft.length > 0,

    // Actions
    handleManufacturerSelect,
    handleModelSelect,

    // Stats
    aircraftCount: trackedAircraft.length,
    filteredCount: filteredAircraft.length,
  };
}
