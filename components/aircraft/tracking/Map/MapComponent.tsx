// MapComponent.tsx
import React, { useState } from 'react';
import type {
  Aircraft,
  SelectOption,
  ActiveModel,
  ExtendedAircraft,
} from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAircraftSelector } from '../../customHooks/useAircraftSelector';
import { useAircraftData } from '../../customHooks/useAircraftData';
import { UnifiedSelector } from '../selector/UnifiedSelector';
import dynamic from 'next/dynamic';

// Dynamic import for the map
const DynamicMap = dynamic(() => import('./DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface MapComponentProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  manufacturers,
  onError,
}) => {
  // Change the state type to string with empty string as default
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');

  // State
  const [isMapReady, setIsMapReady] = useState(false);
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >([]);
  const [models, setModels] = useState<ActiveModel[]>([]);

  // Use aircraft selector hook
  const {
    selectedManufacturer: currentManufacturer,
    selectedModel,
    isLoadingModels,
    handleManufacturerSelect,
    handleModelSelect,
  } = useAircraftSelector({
    onModelsUpdate: (newModels: ActiveModel[]) => {
      setModels(newModels);
    },
    onAircraftUpdate: (aircraft: Aircraft[]) => {
      const extendedAircraft = aircraft.map((a) => ({
        ...a,
        type: a.TYPE_AIRCRAFT || 'Unknown',
        isGovernment: a.OWNER_TYPE === '5',
      }));
      setDisplayedAircraft(extendedAircraft);
    },
    onError,
  });

  // Use aircraft data hook
  const { activeCount, loading: trackingLoading } = useAircraftData();

  // Update handleReset to use empty string instead of null
  const handleReset = () => {
    handleManufacturerSelect('');
    setDisplayedAircraft([]);
    setModels([]);
  };

  // Compute model counts
  const modelCounts = React.useMemo(() => {
    return Object.fromEntries(
      models.reduce((acc, model) => {
        acc.set(model.model, model.activeCount);
        return acc;
      }, new Map())
    );
  }, [models]);

  return (
    <div className="relative w-full h-screen">
      {/* Map Container */}
      <div className="absolute inset-0">
        <DynamicMap aircraft={displayedAircraft} onError={onError} />
      </div>

      {/* Selector UI */}
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          manufacturers={manufacturers}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={handleManufacturerSelect} // Now accepts string | null
          setSelectedModel={handleModelSelect}
          onManufacturerSelect={handleManufacturerSelect} // Now accepts string | null
          onModelSelect={handleModelSelect}
          models={models}
          modelCounts={modelCounts}
          onModelsUpdate={(newModels: ActiveModel[]) => setModels(newModels)}
          totalActive={activeCount}
          onAircraftUpdate={(aircraft: Aircraft[]) => {
            const extendedAircraft = aircraft.map((a) => ({
              ...a,
              type: a.TYPE_AIRCRAFT || 'Unknown',
              isGovernment: a.OWNER_TYPE === '5',
            }));
            setDisplayedAircraft(extendedAircraft);
          }}
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

export default MapComponent;
