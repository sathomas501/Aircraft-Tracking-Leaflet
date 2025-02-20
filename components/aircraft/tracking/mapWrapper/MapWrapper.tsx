import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import dynamic from 'next/dynamic';
import UnifiedSelector from '../../selector/UnifiedSelector';
import type { Aircraft, SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { DynamicMapProps, ExtendedAircraft } from '../Map/DynamicMap';
import { clientTrackingService } from '@/lib/services/tracking-services/client-tracking-service';
import 'react-toastify/dist/ReactToastify.css';

// Dynamically import Map to avoid SSR issues
const DynamicMap = dynamic<DynamicMapProps>(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface MapWrapperProps {
  initialAircraft: Aircraft[];
  manufacturers: SelectOption[];
  onError: (errorMessage: string) => void;
}

// Type for model updates
interface ModelUpdate {
  model: string;
  label: string;
  activeCount?: number;
  count?: number;
}

// Transform Aircraft object
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
  const [models, setModels] = useState<ModelUpdate[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [aircraftTrackingService, setAircraftTrackingService] =
    useState<any>(null);

  // ✅ Safely import AircraftTrackingService **ONLY on the server**
  useEffect(() => {
    if (typeof window === 'undefined') {
      import('@/lib/services/tracking-services/aircraft-tracking-service')
        .then((mod) =>
          setAircraftTrackingService(new mod.AircraftTrackingService())
        )
        .catch((error) => {
          console.error(
            '[Tracking] ❌ Failed to load tracking service:',
            error
          );
          onError('Failed to load tracking service.');
        });
    }
  }, []);

  // ✅ Ensure aircraftTrackingService is loaded before usage
  if (!aircraftTrackingService)
    return <LoadingSpinner message="Initializing tracking..." />;

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    displayedAircraft.forEach((plane) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [displayedAircraft]);

  // ✅ Explicit type for models
  const handleModelsUpdate = useCallback((models: ModelUpdate[]) => {
    setModels(models);
  }, []);

  // ✅ Explicit type for updated aircraft
  const handleAircraftUpdate = useCallback((updatedAircraft: Aircraft[]) => {
    setDisplayedAircraft(updatedAircraft.map(toExtendedAircraft));
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

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      if (manufacturer) {
        try {
          console.log(`[Tracking] Starting tracking for ${manufacturer}`);

          const aircraftData =
            await aircraftTrackingService.processManufacturer(manufacturer);

          const subscription = aircraftTrackingService.subscribeToManufacturer(
            manufacturer,
            (updatedAircraft: Aircraft[]) => {
              // ✅ Explicitly defining type
              console.log(
                `[Tracking] 🔄 Live Update for ${manufacturer}`,
                updatedAircraft
              );
              setDisplayedAircraft(updatedAircraft.map(toExtendedAircraft));
            }
          );

          unsubscribeRef.current = () => subscription.unsubscribe();

          const trackedAircraft =
            await clientTrackingService.getTrackedAircraft();
          if (trackedAircraft.length === 0) {
            console.log(
              `[Tracking] Manually forcing OpenSky fetch for ${manufacturer}`
            );
            await clientTrackingService.pollAircraftData();
          }
        } catch (error) {
          console.error('[Tracking] ❌ Error fetching aircraft:', error);
          onError('Failed to fetch aircraft data.');
        }
      }
    },
    [onError, setDisplayedAircraft, aircraftTrackingService]
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
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, [initialAircraft]);

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
          modelCounts={modelCounts}
          onModelsUpdate={handleModelsUpdate}
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
