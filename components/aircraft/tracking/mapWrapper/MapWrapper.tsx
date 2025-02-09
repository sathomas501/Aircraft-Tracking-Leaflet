import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import UnifiedSelector from '../../selector/UnifiedSelector';
import type { Aircraft, SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { DynamicMapProps, ExtendedAircraft } from '../Map/DynamicMap';

const DynamicMap = dynamic<DynamicMapProps>(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface MapWrapperProps {
  initialAircraft: Aircraft[];
  manufacturers: SelectOption[];
  onError: (errorMessage: string) => void;
}

const MapWrapper: React.FC<MapWrapperProps> = ({
  initialAircraft,
  manufacturers,
  onError,
}) => {
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >(
    initialAircraft.map((aircraft) => ({
      ...aircraft,
      type: aircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
      isGovernment: aircraft.OWNER_TYPE === '5',
    }))
  );
  const [selectedType] = useState<string>('manufacturer');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isMapReady, setIsMapReady] = useState(false);

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    displayedAircraft.forEach((plane) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [displayedAircraft]);

  const handleManufacturerSelect = async (manufacturer: string) => {
    try {
      console.log('Manufacturer selected:', manufacturer);
      setSelectedManufacturer(manufacturer);

      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch aircraft data: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.aircraft || !Array.isArray(data.aircraft)) {
        throw new Error('Invalid aircraft data received');
      }

      // Transform the aircraft data to include UI properties
      const extendedAircraft: ExtendedAircraft[] = data.aircraft.map(
        (aircraft: Aircraft) => ({
          ...aircraft,
          type: aircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
          isGovernment: aircraft.OWNER_TYPE === '5',
        })
      );

      setDisplayedAircraft(extendedAircraft);
    } catch (error) {
      console.error('Failed to fetch aircraft:', error);
      onError(
        error instanceof Error ? error.message : 'Failed to fetch aircraft'
      );
    }
  };

  const handleModelSelect = (model: string) => {
    console.log('Model selected:', model);
    setSelectedModel(model);
    if (!model) return;

    const filteredAircraft = displayedAircraft.filter(
      (plane) => plane.model === model
    );
    setDisplayedAircraft(filteredAircraft);
  };

  const handleReset = () => {
    console.log('Reset triggered');
    setSelectedManufacturer('');
    setSelectedModel('');
    // Transform initialAircraft when resetting
    setDisplayedAircraft(
      initialAircraft.map((aircraft) => ({
        ...aircraft,
        type: aircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
        isGovernment: aircraft.OWNER_TYPE === '5',
      }))
    );
  };

  useEffect(() => {
    setIsMapReady(true);
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={setSelectedManufacturer}
          setSelectedModel={setSelectedModel}
          modelCounts={modelCounts}
          totalActive={displayedAircraft.length}
          manufacturers={manufacturers}
          onAircraftUpdate={(aircraft: Aircraft[]) => {
            // Transform incoming aircraft data
            setDisplayedAircraft(
              aircraft.map((a) => ({
                ...a,
                type: a.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
                isGovernment: a.OWNER_TYPE === '5',
              }))
            );
          }}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          onReset={handleReset}
        />
      </div>

      {isMapReady && (
        <div className="absolute inset-0">
          <DynamicMap aircraft={displayedAircraft} />
        </div>
      )}
    </div>
  );
};

export default MapWrapper;
