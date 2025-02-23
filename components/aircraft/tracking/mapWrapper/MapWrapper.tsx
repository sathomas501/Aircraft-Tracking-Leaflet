// MapWrapper.tsx
import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type {
  Aircraft,
  SelectOption,
  ActiveModel,
  ExtendedAircraft,
} from '../../../../types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { UnifiedSelector } from '../selector/UnifiedSelector';
import { useAircraftSelector } from '../../customHooks/useAircraftSelector';
import { useAircraftData } from '../../customHooks/useAircraftData';

// Dynamic import for the map
const DynamicMap = dynamic(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

export interface MapWrapperProps {
  initialAircraft: Aircraft[];
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

const MapWrapper: React.FC<MapWrapperProps> = ({ manufacturers, onError }) => {
  const [isMapReady, setIsMapReady] = useState(false);
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >([]);

  const {
    selectedManufacturer,
    selectedModel,
    models,
    isLoadingModels,
    handleManufacturerSelect,
    handleModelSelect,
  } = useAircraftSelector({
    onModelsUpdate: (newModels: ActiveModel[]) => {
      console.log('[MapWrapper] Models updated:', newModels.length);
    },
    onAircraftUpdate: (aircraft: Aircraft[]) => {
      console.log('[MapWrapper] Aircraft updated:', aircraft.length);
      const extendedAircraft = aircraft.map((a) => ({
        ...a,
        type: a.TYPE_AIRCRAFT || 'Unknown',
        isGovernment: a.OWNER_TYPE === '5',
      }));
      setDisplayedAircraft(extendedAircraft);
    },
    onError,
  });

  const {
    activeCount,
    liveAircraft,
    loading: trackingLoading,
  } = useAircraftData();

  const handleReset = useCallback(() => {
    handleManufacturerSelect(null);
  }, [handleManufacturerSelect]);

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
          models={models}
          modelCounts={Object.fromEntries(
            models.reduce((acc, model) => {
              acc.set(model.model, model.activeCount);
              return acc;
            }, new Map())
          )}
          onModelsUpdate={() => {}} // Handled by useAircraftSelector
          totalActive={activeCount}
          onAircraftUpdate={() => {}} // Handled by useAircraftSelector
          onReset={handleReset}
          onError={onError}
        />
      </div>

      {/* Loading indicator */}
      {(isLoadingModels || trackingLoading) && (
        <div className="absolute top-4 right-4 z-20">
          <LoadingSpinner
            message={
              isLoadingModels ? 'Loading models...' : 'Tracking aircraft...'
            }
          />
        </div>
      )}
    </div>
  );
};

export default MapWrapper;
