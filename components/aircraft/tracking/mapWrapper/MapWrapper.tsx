import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import dynamic from 'next/dynamic';
import { UnifiedSelector } from '../../selector/UnifiedSelector';
import type { Aircraft, SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { DynamicMapProps, ExtendedAircraft } from '../Map/DynamicMap';
import { clientTrackingService } from '@/lib/services/tracking-services/client-tracking-service';
import { normalizeAircraft } from '@/utils/aircraft-transform1';

const DynamicMap = dynamic<DynamicMapProps>(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface MapWrapperProps {
  initialAircraft: Aircraft[];
  manufacturers: SelectOption[];
  onError: (errorMessage: string) => void;
}

interface ModelUpdate {
  model: string;
  label: string;
  activeCount?: number;
  count?: number;
}

function toExtendedAircraft(
  aircraft: Aircraft | Partial<Aircraft>
): ExtendedAircraft {
  const normalizedAircraft = normalizeAircraft({
    ...aircraft,
    lastSeen: Date.now(),
    'N-NUMBER': aircraft['N-NUMBER'] || '',
    manufacturer: aircraft.manufacturer || '',
    NAME: aircraft.NAME || '',
    CITY: aircraft.CITY || '',
    STATE: aircraft.STATE || '',
    TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || '',
    OWNER_TYPE: aircraft.OWNER_TYPE || '',
    model: aircraft.model || '',
    operator: aircraft.operator || '',
  });

  return {
    ...normalizedAircraft,
    type:
      normalizedAircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
    isGovernment: normalizedAircraft.OWNER_TYPE === '5',
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

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    displayedAircraft.forEach((plane) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [displayedAircraft]);

  const handleModelsUpdate = useCallback((updatedModels: ModelUpdate[]) => {
    setModels(updatedModels);
  }, []);

  const handleAircraftUpdate = useCallback(
    (updatedAircraft: Aircraft[] | null | undefined) => {
      if (!updatedAircraft || updatedAircraft.length === 0) {
        console.warn('[MapWrapper] ⚠ No aircraft received for update.');
        return;
      }

      setDisplayedAircraft(updatedAircraft.map(toExtendedAircraft));
    },
    []
  );

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  const handleReset = useCallback(() => {
    console.log('Reset triggered');
    setSelectedManufacturer('');
    setSelectedModel('');
    setDisplayedAircraft(initialAircraft.map(toExtendedAircraft));
    clientTrackingService.stopTracking();
  }, [initialAircraft]);

  useEffect(() => {
    setIsMapReady(true);
    return () => {
      clientTrackingService.stopTracking();
    };
  }, []);

  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      setSelectedManufacturer(manufacturer || '');
      setSelectedModel('');

      // Stop existing tracking before starting new
      clientTrackingService.stopTracking();

      if (manufacturer) {
        try {
          console.log(`[Tracking] Starting tracking for ${manufacturer}`);

          // Try to get server-side data first
          if (typeof window === 'undefined') {
            const { getAircraftTrackingService } = await import(
              '@/lib/services/tracking-services/aircraft-tracking-service'
            );
            const trackingService = getAircraftTrackingService();
            const aircraftData =
              await trackingService.processManufacturer(manufacturer);
            setDisplayedAircraft(
              aircraftData.map((ac) => toExtendedAircraft(ac))
            );
          }

          // Start client-side tracking
          await clientTrackingService.startTracking(manufacturer);

          // Initial poll
          const trackedAircraft =
            await clientTrackingService.getTrackedAircraft();
          if (trackedAircraft.length === 0) {
            console.log(
              `[Tracking] Manually forcing OpenSky fetch for ${manufacturer}`
            );
            await clientTrackingService.pollAircraftData();
          } else {
            setDisplayedAircraft(
              trackedAircraft.map((ac) => toExtendedAircraft(ac))
            );
          }
        } catch (error) {
          console.error('[Tracking] ❌ Error:', error);
          onError('Failed to fetch aircraft data.');
        }
      }
    },
    [onError]
  );

  // Subscribe to tracking updates
  useEffect(() => {
    const subscriber = {
      manufacturer: selectedManufacturer,
      callback: (updatedAircraft: Aircraft[]) => {
        console.log(`[Tracking] 🔄 Live Update for ${selectedManufacturer}`);
        setDisplayedAircraft(
          updatedAircraft.map((ac) => toExtendedAircraft(ac))
        );
      },
    };

    if (selectedManufacturer) {
      (clientTrackingService as any).subscribers.add(subscriber);
    }

    return () => {
      if (selectedManufacturer) {
        (clientTrackingService as any).subscribers.delete(subscriber);
      }
    };
  }, [selectedManufacturer]);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={(manufacturer: string | null) =>
            setSelectedManufacturer(manufacturer || '')
          }
          setSelectedModel={setSelectedModel}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          models={models}
          modelCounts={Object.fromEntries(modelCounts)}
          onModelsUpdate={handleModelsUpdate}
          totalActive={displayedAircraft.length}
          manufacturers={manufacturers}
          onAircraftUpdate={handleAircraftUpdate}
          onReset={handleReset}
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
