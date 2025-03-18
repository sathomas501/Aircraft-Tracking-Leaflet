import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type {
  Aircraft,
  SelectOption,
  ExtendedAircraft,
} from '../../../../types/base';
import type { AircraftModel } from '../../../../types/aircraft-models';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import UnifiedSelector from '../selector/UnifiedSelector';
import { useOpenSkyData } from '../../../../hooks/useOpenSkyData';
import { useFetchModels } from '../../../../hooks/useFetchModels';
import { transformToExtendedAircraft } from '../../../../utils/aircraft-transform1';

const DynamicMap = dynamic(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

export interface MapComponentProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  manufacturers,
  onError,
}) => {
  // ✅ Fix: Declare useState variables
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedManufacturerLabel, setSelectedManufacturerLabel] =
    useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // ✅ Fetch data
  const { trackedAircraft, isInitializing, trackingStatus } =
    useOpenSkyData(selectedManufacturer);
  const { models, loading: loadingModels } = useFetchModels(
    selectedManufacturer,
    selectedManufacturerLabel
  );

  const extendedAircraft = transformToExtendedAircraft(trackedAircraft);

  <DynamicMap aircraft={extendedAircraft} onError={onError} />;

  // ✅ Fix: Ensure state updates avoid `null`
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      const manuValue = manufacturer ?? '';
      setSelectedManufacturer(manuValue);
      setSelectedManufacturerLabel(
        manufacturers.find((m) => m.value === manuValue)?.label || ''
      );
      setSelectedModel('');
    },
    [manufacturers]
  );

  const handleModelSelect = useCallback((model: string | null) => {
    setSelectedModel(model ?? '');
  }, []);

  // ✅ Fix: Ensure `models` have `totalCount`
  const enhancedModels = useMemo(() => {
    return models.map((model) => ({
      ...model,
      totalCount: model.activeCount || 0, // Add totalCount if missing
    })) as AircraftModel[];
  }, [models]);

  // ✅ Process aircraft data
  useEffect(() => {
    if (trackedAircraft) {
      // First filter by model if needed
      const filtered = selectedModel
        ? trackedAircraft.filter(
            (a) =>
              a.model === selectedModel || a.TYPE_AIRCRAFT === selectedModel
          )
        : trackedAircraft;

      // Then transform to ExtendedAircraft before setting state
      const extendedFiltered = filtered.map((aircraft) => ({
        ...aircraft,
        type: aircraft.TYPE_AIRCRAFT || 'Unknown',
        isGovernment: aircraft.OWNER_TYPE === '5',
      })) as ExtendedAircraft[];

      setDisplayedAircraft(extendedFiltered);
    }
  }, [trackedAircraft, selectedModel]);

  const handleReset = useCallback(() => {
    handleManufacturerSelect(null);
  }, [handleManufacturerSelect]);

  const modelCounts = useMemo(() => {
    return Object.fromEntries(
      models.reduce((acc, model) => {
        acc.set(model.model, model.activeCount);
        return acc;
      }, new Map())
    );
  }, [models]);

  const isLoading = isInitializing || loadingModels;

  return (
    <div className="relative w-full h-screen">
      <div className="absolute inset-0"></div>

      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          manufacturers={manufacturers}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={handleManufacturerSelect}
          setSelectedModel={handleModelSelect}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          models={enhancedModels} // Use enhancedModels instead of models
          modelCounts={modelCounts}
          onModelsUpdate={(updatedModels) => {
            console.log('[MapComponent] Models updated:', updatedModels.length);
          }} // ✅ Added missing prop
          totalActive={trackedAircraft?.length || 0}
          onAircraftUpdate={() => {
            /* Handled directly now */
          }}
          onReset={handleReset}
          onError={onError}
        />
      </div>

      {isLoading && (
        <div className="absolute top-4 right-4 z-20">
          <LoadingSpinner
            message={
              loadingModels ? 'Loading models...' : 'Tracking aircraft...'
            }
          />
        </div>
      )}

      {trackingStatus && !isLoading && (
        <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
          <p className="text-sm">{trackingStatus}</p>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
