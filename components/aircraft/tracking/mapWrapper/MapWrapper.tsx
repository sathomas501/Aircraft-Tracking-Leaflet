import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { UnifiedSelector } from '../../selector/UnifiedSelector';
import type { SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { DynamicMapProps, ExtendedAircraft } from '../Map/DynamicMap';
import { clientTrackingService } from '@/lib/services/tracking-services/client-tracking-service';
import { AircraftModel } from '../../selector/types';
import { Aircraft as BaseAircraft } from '@/types/base'; // Import with alias to avoid confusion
import { BaseTransforms, normalizeAircraft } from '@/utils/aircraft-transform1';
import type { Aircraft as TrackingAircraft } from '@/types/base';

interface Aircraft extends TrackingAircraft {
  'N-NUMBER': string;
  manufacturer: string;
  NAME: string;
  CITY: string;
  STATE: string;
  TYPE_AIRCRAFT: string;
  OWNER_TYPE: string;
}

// Helper function to convert Aircraft to ExtendedAircraft
function toExtendedAircraft(aircraft: Aircraft): ExtendedAircraft {
  const normalizedAircraft = normalizeAircraft(aircraft);
  return {
    ...normalizedAircraft,
    type:
      normalizedAircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
    isGovernment: normalizedAircraft.OWNER_TYPE === '5',
  };
}

// Helper function for processing models
function processAircraftToModels(aircraft: Aircraft[]): AircraftModel[] {
  const modelMap = new Map<string, AircraftModel>();

  aircraft.forEach((a) => {
    if (!a.model) return;

    const key = `${a.manufacturer}-${a.model}`;
    const existing = modelMap.get(key);

    if (existing) {
      existing.activeCount++;
      existing.totalCount++;
      if (existing.icao24s && a.icao24) {
        existing.icao24s.push(a.icao24);
      }
    } else {
      modelMap.set(key, {
        model: a.model,
        manufacturer: a.manufacturer,
        label: `${a.model} (${a.isTracked ? '1' : '0'} active)`,
        activeCount: a.isTracked ? 1 : 0,
        totalCount: 1,
        icao24s: a.icao24 ? [a.icao24] : [],
      });
    }
  });

  return Array.from(modelMap.values());
}

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
  // State definitions with proper initial values
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >(() => initialAircraft.map(toExtendedAircraft));
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isMapReady, setIsMapReady] = useState(false);
  const [models, setModels] = useState<AircraftModel[]>([]);
  const [modelCounts, setModelCounts] = useState<Map<string, number>>(
    new Map()
  );

  // Convert aircraft to AircraftModel
  const processModels = useCallback((aircraft: Aircraft[]): AircraftModel[] => {
    const modelMap = new Map<string, AircraftModel>();

    aircraft.forEach((a) => {
      const key = `${a.manufacturer}-${a.model}`;
      const existing = modelMap.get(key);

      if (existing) {
        existing.activeCount++;
        existing.totalCount++;
        if (existing.icao24s && a.icao24) {
          existing.icao24s.push(a.icao24);
        }
      } else {
        modelMap.set(key, {
          model: a.model || '',
          manufacturer: a.manufacturer,
          label: `${a.model || 'Unknown'}`,
          activeCount: 1,
          totalCount: 1,
          icao24s: a.icao24 ? [a.icao24] : [],
        });
      }
    });

    return Array.from(modelMap.values());
  }, []);

  // Handle aircraft updates
  const handleAircraftUpdate = useCallback((aircraft: Aircraft[]) => {
    const normalizedAircraft = aircraft.map((a) =>
      normalizeAircraft(a as BaseAircraft)
    );
    const extendedAircraft = normalizedAircraft.map(toExtendedAircraft);
    setDisplayedAircraft(extendedAircraft);

    // Update models and counts
    const processedModels = processAircraftToModels(normalizedAircraft);
    setModels(processedModels);

    // Update model counts
    const counts = new Map<string, number>();
    normalizedAircraft.forEach((a) => {
      if (a.model) {
        counts.set(a.model, (counts.get(a.model) || 0) + (a.isTracked ? 1 : 0));
      }
    });
    setModelCounts(counts);
  }, []);

  // Handle model updates
  const handleModelsUpdate = useCallback((updatedModels: AircraftModel[]) => {
    setModels(updatedModels);
  }, []);

  // Handle model selection
  const handleModelSelect = useCallback(
    (model: string) => {
      if (!model) {
        setDisplayedAircraft((prevAircraft) =>
          prevAircraft.filter((a) => a.manufacturer === selectedManufacturer)
        );
        return;
      }

      setDisplayedAircraft((prevAircraft) =>
        prevAircraft.filter((a) => a.model === model)
      );
    },
    [selectedManufacturer]
  );

  // Handle reset
  const handleReset = useCallback(() => {
    setSelectedManufacturer('');
    setSelectedModel('');
    setDisplayedAircraft([]);
    setModels([]);
    setModelCounts(new Map());
  }, []);

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      try {
        if (!manufacturer) {
          handleAircraftUpdate([]);
          return;
        }

        clientTrackingService.stopTracking();

        await clientTrackingService.startTracking(manufacturer);
        const trackedAircraft =
          await clientTrackingService.getTrackedAircraft();

        // Use normalizeAircraft from your utilities
        const normalizedAircraft = trackedAircraft.map((aircraft) =>
          normalizeAircraft({
            ...aircraft,
            'N-NUMBER': '',
            manufacturer: manufacturer,
            NAME: '',
            CITY: '',
            STATE: '',
            TYPE_AIRCRAFT: '',
            OWNER_TYPE: '',
            isTracked: true,
            lastSeen: Date.now(),
          })
        ) as Aircraft[];

        if (trackedAircraft.length === 0) {
          await clientTrackingService.pollAircraftData();
        } else {
          handleAircraftUpdate(normalizedAircraft);
        }
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : 'Failed to select manufacturer'
        );
      }
    },
    [handleAircraftUpdate, onError]
  );

  const handleSetSelectedManufacturer = useCallback(
    (manufacturer: string | null) => {
      setSelectedManufacturer(manufacturer || '');
    },
    []
  );

  // Subscribe to tracking updates
  useEffect(() => {
    const subscriber = {
      manufacturer: selectedManufacturer,
      callback: (updatedAircraft: Aircraft[]) => {
        console.log(`[Tracking] 🔄 Live Update for ${selectedManufacturer}`);
        setDisplayedAircraft(updatedAircraft.map(toExtendedAircraft));
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

  // Initialize map
  useEffect(() => {
    setIsMapReady(true);
    return () => {
      clientTrackingService.stopTracking();
    };
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          manufacturers={manufacturers}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={handleSetSelectedManufacturer} // Use our wrapper function
          setSelectedModel={setSelectedModel}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          models={models}
          modelCounts={Object.fromEntries(modelCounts)}
          onModelsUpdate={setModels}
          totalActive={displayedAircraft.length}
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
