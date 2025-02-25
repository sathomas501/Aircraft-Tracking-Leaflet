import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import { UnifiedSelectorProps } from '../selector/types';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import { useOpenSkyData } from '../../customHooks/useOpenSkyData';

const fetchIcao24s = async (manufacturer: string): Promise<string[]> => {
  try {
    const response = await fetch('/api/aircraft/icao24s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer }),
    });

    if (!response.ok) {
      throw new Error(`[API] ❌ Failed to fetch ICAO24s for ${manufacturer}`);
    }

    const data = await response.json();
    return data.success && data.data?.icao24List ? data.data.icao24List : [];
  } catch (error) {
    console.error(`[API] ❌ Error fetching ICAO24s:`, error);
    return [];
  }
};

export const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  selectedModel,
  setSelectedManufacturer,
  setSelectedModel,
  onManufacturerSelect,
  onModelSelect,
  onAircraftUpdate,
  onModelsUpdate,
  onReset,
  onError,
  models,
  modelCounts,
  totalActive = 0,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [loadingIcao24s, setLoadingIcao24s] = useState<boolean>(false);

  // Connect to OpenSky tracking system
  const {
    isInitializing,
    trackingStatus,
    trackedAircraft,
    aircraftModels,
    error: trackingError,
  } = useOpenSkyData(selectedManufacturer);

  // Notify parent component of updates
  useEffect(() => {
    if (trackingError && onError) {
      onError(trackingError.message);
    }
  }, [trackingError, onError]);

  useEffect(() => {
    if (trackedAircraft && onAircraftUpdate) {
      onAircraftUpdate(trackedAircraft);
    }
  }, [trackedAircraft, onAircraftUpdate]);

  useEffect(() => {
    if (aircraftModels && onModelsUpdate) {
      onModelsUpdate(aircraftModels);
    }
  }, [aircraftModels, onModelsUpdate]);

  const handleToggle = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  /**
   * Handle manufacturer selection
   */
  const onManufacturerSelectHandler = useCallback(
    async (manufacturer: string | null) => {
      if (!manufacturer) return;

      setSelectedManufacturer(manufacturer);
      console.log(`[UnifiedSelector] Manufacturer selected: ${manufacturer}`);

      try {
        setLoadingIcao24s(true);
        await fetchIcao24s(manufacturer); // ✅ Fetch ICAO24s using the hook

        console.log(`[UnifiedSelector] ✅ ICAO24s fetched from hook`);
      } catch (error) {
        console.error('[UnifiedSelector] ❌ Error fetching ICAO24s:', error);
        onError?.('Error fetching aircraft data.');
      } finally {
        setLoadingIcao24s(false);
      }
    },
    [fetchIcao24s, onError]
  );

  const processedModels = React.useMemo(
    () =>
      models.map((model) => ({
        ...model,
        label: `${model.model} (${modelCounts[model.model] || 0} active)`,
      })),
    [models, modelCounts]
  );

  /**
   * Handle reset button click
   */
  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    }
  }, [onReset]);

  if (isMinimized) {
    return (
      <button
        onClick={handleToggle}
        className="absolute top-4 left-4 z-[3000] p-2 bg-white rounded-md shadow-lg hover:bg-gray-200"
        aria-label="Expand aircraft selector"
      >
        <Plus size={16} />
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-[320px] absolute top-4 left-4 z-[3000]">
      <div className="flex justify-between items-center mb-2">
        <button
          onClick={handleToggle}
          className="p-1 bg-gray-200 rounded-md mr-2 hover:bg-gray-300"
          aria-label="Minimize aircraft selector"
        >
          <Minus size={16} />
        </button>
        <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
        <button
          onClick={handleReset}
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Reset
        </button>
      </div>

      <ManufacturerSelector
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onSelect={onManufacturerSelectHandler}
      />

      {selectedManufacturer && (
        <ModelSelector
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          models={processedModels}
          totalActive={totalActive}
          onModelSelect={onModelSelect}
        />
      )}

      {/* Show tracking status */}
      {trackingStatus && (
        <div className="mt-2 p-2 border rounded bg-gray-50">
          <div className="flex items-center">
            {isInitializing && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            )}
            <span className="text-sm text-gray-700">{trackingStatus}</span>
          </div>
        </div>
      )}

      {/* Show aircraft count if available */}
      {trackedAircraft.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          Found {trackedAircraft.length} aircraft
        </div>
      )}
    </div>
  );
};

export default UnifiedSelector;
