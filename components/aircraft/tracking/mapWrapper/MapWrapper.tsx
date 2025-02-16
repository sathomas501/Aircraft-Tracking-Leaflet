import React, { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import UnifiedSelector from '../../selector/UnifiedSelector';
import type { Aircraft, SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { DynamicMapProps, ExtendedAircraft } from '../Map/DynamicMap';
import { clientTrackingService } from '@/lib/services/tracking-services/client-tracking-service';
import { AircraftTrackingService } from '@/lib/services/tracking-services/aircraft-tracking-service';
import 'react-toastify/dist/ReactToastify.css';

const DynamicMap = dynamic<DynamicMapProps>(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface MapWrapperProps {
  initialAircraft: Aircraft[];
  manufacturers: SelectOption[];
  onError: (errorMessage: string) => void;
}

function toExtendedAircraft(aircraft: Aircraft): ExtendedAircraft {
  return {
    ...aircraft,
    type: aircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
    isGovernment: aircraft.OWNER_TYPE === '5',
  };
}

const MapWrapper: React.FC<MapWrapperProps> = ({
  initialAircraft,
  manufacturers,
  onError,
}) => {
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >(initialAircraft.map(toExtendedAircraft));
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isMapReady, setIsMapReady] = useState(false);
  const [models, setModels] = useState<
    { model: string; label: string; activeCount?: number; count?: number }[]
  >([]);
  let unsubscribe: (() => void) | null = null;

  const aircraftTrackingService = new AircraftTrackingService();

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    displayedAircraft.forEach((plane) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [displayedAircraft]);

  const handleModelsUpdate = useCallback(
    (
      models: {
        model: string;
        label: string;
        activeCount?: number;
        count?: number;
      }[]
    ) => {
      setModels(models);
    },
    []
  );

  // Function to update displayed aircraft
  const handleAircraftUpdate = useCallback((aircraftList: Aircraft[]) => {
    setDisplayedAircraft(aircraftList.map(toExtendedAircraft));
  }, []);

  // Handle model selection
  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  // Handle manufacturer selection & tracking updates
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      setSelectedManufacturer(manufacturer || '');
      setSelectedModel('');

      if (unsubscribe) {
        unsubscribe(); // ✅ Unsubscribe from previous updates
        unsubscribe = null;
      }

      if (manufacturer) {
        try {
          console.log(`[Tracking] Starting tracking for ${manufacturer}`);

          // ✅ Fetch and merge live & static data
          const aircraftData =
            await aircraftTrackingService.processManufacturer(manufacturer);
          unsubscribe = aircraftTrackingService.subscribeToManufacturer(
            manufacturer,
            (updatedAircraft: Aircraft[]) => {
              setDisplayedAircraft(updatedAircraft.map(toExtendedAircraft));
            }
          );

          // ✅ Subscribe to real-time updates
          unsubscribe = aircraftTrackingService.subscribeToManufacturer(
            manufacturer,
            (updatedAircraft: Aircraft[]) => {
              console.log(
                `[Tracking] 🔄 Live Update for ${manufacturer}`,
                updatedAircraft
              );
              setDisplayedAircraft(updatedAircraft.map(toExtendedAircraft));
            }
          );

          // ✅ Fetch only if no recent tracking data exists
          const trackedAircraft =
            await clientTrackingService.getTrackedAircraft();
          if (trackedAircraft.length === 0) {
            console.log(
              `[Tracking] Manually forcing OpenSky fetch for ${manufacturer}`
            );
            await clientTrackingService.pollAircraftData();
          } else {
            console.log(
              `[Tracking] ✅ Skipping manual fetch - tracking data already exists.`
            );
          }
        } catch (error) {
          console.error('[Tracking] ❌ Error fetching aircraft:', error);
          onError('Failed to fetch aircraft data.');
        }
      }
    },
    []
  );

  useEffect(() => {
    setIsMapReady(true);
  }, []);

  // Reset selections and clear data
  const handleReset = useCallback(() => {
    console.log('Reset triggered');
    setSelectedManufacturer('');
    setSelectedModel('');
    setDisplayedAircraft(initialAircraft.map(toExtendedAircraft));
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }, [initialAircraft]);

  // Ensure the map initializes correctly
  useEffect(() => {
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    console.log('[Debug] Updated Displayed Aircraft:', displayedAircraft);
  }, [displayedAircraft]);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={(manufacturer) =>
            setSelectedManufacturer(manufacturer || '')
          }
          setSelectedModel={setSelectedModel}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          modelCounts={modelCounts} // ✅ Fix: Add missing prop
          onModelsUpdate={handleModelsUpdate} // ✅ Fix: Add missing prop
          totalActive={displayedAircraft.length}
          manufacturers={manufacturers}
          onAircraftUpdate={handleAircraftUpdate}
          onReset={() =>
            setDisplayedAircraft(initialAircraft.map(toExtendedAircraft))
          }
          onError={onError}
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
