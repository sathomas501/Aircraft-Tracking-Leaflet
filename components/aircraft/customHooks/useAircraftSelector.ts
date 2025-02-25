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
  const [models, setModels] = useState<AircraftModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<Error | null>(null);

  // Connect to OpenSky data
  const {
    trackedAircraft,
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

  // Load models for the selected manufacturer
  const loadModels = useCallback(
    async (manufacturer: string | null) => {
      if (!manufacturer) {
        setModels([]);
        onModelsUpdate([]);
        return;
      }

      // Check cache first
      const cachedEntry = modelsCache[manufacturer];
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
        console.log(
          `[useAircraftSelector] Using cached models for ${manufacturer}`
        );
        setModels(cachedEntry.models);
        onModelsUpdate(cachedEntry.models);
        return;
      }

      setIsLoadingModels(true);
      setModelError(null);

      try {
        console.log(
          `[useAircraftSelector] Fetching models for ${manufacturer}`
        );
        const fetchedModels = await fetchModels(manufacturer);

        // Process models to ensure they're in the right format
        const processedModels: AircraftModel[] = fetchedModels.map((model) => ({
          model: model.model || '',
          manufacturer: model.manufacturer || manufacturer,
          label: `${model.model} (${model.activeCount ?? 0} active)`,
          activeCount: model.activeCount ?? 0,
          count: (model as any).count ?? 0,
          totalCount: (model as any).totalCount ?? (model as any).count ?? 0,
        }));

        // Sort models by activeCount (descending) then name
        const sortedModels = [...processedModels].sort((a, b) => {
          const countDiff = (b.activeCount ?? 0) - (a.activeCount ?? 0);
          return countDiff !== 0
            ? countDiff
            : (a.model || '').localeCompare(b.model || '');
        });

        // Cache the models
        modelsCache[manufacturer] = {
          models: sortedModels,
          timestamp: Date.now(),
        };

        // Update state
        setModels(sortedModels);
        onModelsUpdate(sortedModels);
      } catch (error) {
        console.error('[useAircraftSelector] Error fetching models:', error);
        setModelError(
          error instanceof Error ? error : new Error('Failed to load models')
        );
        onError('Failed to load aircraft models');
      } finally {
        setIsLoadingModels(false);
      }
    },
    [onModelsUpdate, onError]
  );

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(
    (manufacturer: string | null) => {
      setSelectedManufacturer(manufacturer);
      setSelectedModel(null); // Reset model selection

      // Load models for the new manufacturer
      loadModels(manufacturer);
    },
    [loadModels]
  );

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
    models,
    allAircraft: trackedAircraft,
    filteredAircraft,

    // Status
    isLoading: isLoadingModels || isInitializing,
    trackingStatus,
    error: trackingError || modelError,

    // Actions
    handleManufacturerSelect,
    handleModelSelect,

    // Stats
    aircraftCount: trackedAircraft.length,
    filteredCount: filteredAircraft.length,
  };
}
