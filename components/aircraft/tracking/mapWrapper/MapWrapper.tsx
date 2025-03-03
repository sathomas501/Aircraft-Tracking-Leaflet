import React, { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type {
  Aircraft,
  SelectOption,
  ExtendedAircraft,
} from '../../../../types/base';
import { AircraftModel } from '@/types/aircraft-models';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
// Import the component using default import
import UnifiedSelector from '../selector/UnifiedSelector';
import { useOpenSkyData } from '../../customHooks/useOpenSkyData';
import { useFetchModels } from '../../customHooks/useFetchModels';
import { useFetchManufacturers } from '../../customHooks/useFetchManufactures';

const DynamicMap = dynamic(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

export interface MapWrapperProps {
  initialAircraft?: Aircraft[];
  manufacturers?: SelectOption[];
  onError: (message: string) => void;
}

const MapWrapper: React.FC<MapWrapperProps> = ({ onError }) => {
  // Fetch manufacturers & ICAO24s
  const { manufacturers, fetchManufacturerIcao24s, loading, error } =
    useFetchManufacturers();

  // State for selections
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedManufacturerLabel, setSelectedManufacturerLabel] =
    useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >([]);

  // Fetch aircraft tracking data based on ICAO24s
  const { trackedAircraft, isInitializing, trackingStatus } =
    useOpenSkyData(selectedManufacturer);

  // Get model data
  const { models, loading: loadingModels } = useFetchModels(
    selectedManufacturer,
    selectedManufacturerLabel
  );

  // Process aircraft for display
  const processAircraft = useCallback((aircraft: Aircraft[]) => {
    console.log('[MapWrapper] Aircraft updated:', aircraft.length);
    const extended = aircraft.map((a) => ({
      ...a,
      type: a.TYPE_AIRCRAFT || 'Unknown',
      isGovernment: a.OWNER_TYPE === '5',
    }));
    setDisplayedAircraft(extended);
  }, []);

  // Update displayed aircraft when tracked aircraft changes
  useEffect(() => {
    if (trackedAircraft) {
      const filtered = selectedModel
        ? trackedAircraft.filter(
            (a) =>
              a.model === selectedModel || a.TYPE_AIRCRAFT === selectedModel
          )
        : trackedAircraft;
      processAircraft(filtered);
    }
  }, [trackedAircraft, selectedModel, processAircraft]);

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      const manuValue = manufacturer || '';
      setSelectedManufacturer(manuValue);

      if (manufacturer) {
        const manufacturerObj = manufacturers.find(
          (m) => m.value === manufacturer
        );
        setSelectedManufacturerLabel(manufacturerObj?.label || manufacturer);

        // Pass `manufacturer` as an argument to fetch ICAO24s
        await fetchManufacturerIcao24s(manufacturer);
      } else {
        setSelectedManufacturerLabel('');
      }

      setSelectedModel('');
    },
    [manufacturers, fetchManufacturerIcao24s]
  );

  // Handle model selection
  const handleModelSelect = useCallback((model: string | null) => {
    setSelectedModel(model || '');
  }, []);

  // Transform models to include required totalCount
  const enhancedModels = useMemo(() => {
    return models.map((model) => ({
      ...model,
      totalCount: (model as any).totalCount || model.count || 0,
      activeCount: model.activeCount || 0,
      label: model.label ?? `${model.model} (${model.activeCount || 0} active)`,
    })) as AircraftModel[];
  }, [models]);

  // Handle reset
  const handleReset = useCallback(() => {
    handleManufacturerSelect(null);
  }, [handleManufacturerSelect]);

  // Calculate model counts
  const modelCounts = useMemo(() => {
    return Object.fromEntries(
      models.reduce((acc, model) => {
        acc.set(model.model, model.activeCount);
        return acc;
      }, new Map())
    );
  }, [models]);

  // Determine loading state
  const isLoading = isInitializing || loadingModels;

  return (
    <div className="relative w-full h-screen">
      <div className="absolute inset-0">
        <DynamicMap aircraft={displayedAircraft} onError={onError} />
      </div>

      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          manufacturers={manufacturers}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={handleManufacturerSelect}
          setSelectedModel={handleModelSelect}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          models={enhancedModels}
          modelCounts={modelCounts}
          totalActive={trackedAircraft?.length || 0}
          onReset={handleReset}
          onError={onError}
          onAircraftUpdate={processAircraft}
          onModelsUpdate={(updatedModels: AircraftModel[]) => {
            console.log('[MapWrapper] Models updated:', updatedModels.length);
          }}
          isLoading={isLoading}
          trackingStatus={trackingStatus || ''}
        />
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 right-4 z-20">
          <LoadingSpinner
            message={
              loadingModels ? 'Loading models...' : 'Tracking aircraft...'
            }
          />
        </div>
      )}

      {/* Tracking status */}
      {trackingStatus && !isLoading && (
        <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
          <p className="text-sm">{trackingStatus}</p>
        </div>
      )}
    </div>
  );
};

export default MapWrapper;
