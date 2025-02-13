import React, { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import UnifiedSelector from '../../selector/UnifiedSelector';
import type { Aircraft, SelectOption, OpenSkyStateArray } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { DynamicMapProps, ExtendedAircraft } from '../Map/DynamicMap';
import { clientTrackingService } from '@/lib/services/tracking-services/client-tracking-service';
import { toast } from 'react-toastify';
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

interface OpenSkyStateValidation {
  isValid: boolean;
  errors: string[];
}

// Helper function to transform Aircraft to ExtendedAircraft
function toExtendedAircraft(aircraft: Aircraft): ExtendedAircraft {
  return {
    ...aircraft,
    type: aircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
    isGovernment: aircraft.OWNER_TYPE === '5',
  };
}

function validateOpenSkyState(
  state: OpenSkyStateArray
): OpenSkyStateValidation {
  const errors: string[] = [];

  if (!Array.isArray(state)) {
    return { isValid: false, errors: ['Invalid state format'] };
  }

  if (!state[0]) errors.push('Missing ICAO24');
  if (state[6] === null || state[6] === undefined)
    errors.push('Missing latitude');
  if (state[5] === null || state[5] === undefined)
    errors.push('Missing longitude');

  return {
    isValid: errors.length === 0,
    errors,
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

  const [selectedType] = useState<string>('manufacturer');
  const [isMapReady, setIsMapReady] = useState(false);
  const [models, setModels] = useState<
    { model: string; label: string; activeCount?: number; count?: number }[]
  >([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const handleModelsUpdate = (
    models: {
      model: string;
      label: string;
      activeCount?: number;
      count?: number;
    }[]
  ) => {
    setModels(models);
  };

  const handleError = (errorMessage: string) => {
    console.error(`[ERROR] ${errorMessage}`);
  };

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    displayedAircraft.forEach((plane) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [displayedAircraft]);

  // Fix missing function definition
  const handleAircraftUpdate = useCallback((aircraftList: Aircraft[]) => {
    setDisplayedAircraft(aircraftList.map(toExtendedAircraft));
  }, []);

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  // Fix the function and ensure it has a closing bracket
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      setSelectedManufacturer(manufacturer || ''); // ✅ Ensure string value
      setSelectedModel(''); // ✅ Reset model when changing manufacturer

      if (manufacturer) {
        try {
          console.log(`[Tracking] Starting tracking for ${manufacturer}`);
          await clientTrackingService.startTracking(manufacturer);
        } catch (error) {
          console.error('[Tracking] Error fetching aircraft:', error);
        }
      }
    },
    [setSelectedManufacturer]
  );

  const handleReset = useCallback(() => {
    console.log('Reset triggered');
    setSelectedManufacturer('');
    setSelectedModel('');
    setDisplayedAircraft(initialAircraft.map(toExtendedAircraft));
  }, [initialAircraft]);

  useEffect(() => {
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    if (isMapReady && displayedAircraft.length === 0) {
      toast.info('No active aircraft found for the selected manufacturer.', {
        position: 'top-center',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [displayedAircraft]);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={(manufacturer) =>
            setSelectedManufacturer(manufacturer || '')
          } // ✅ Fix: Convert `null` to an empty string
          setSelectedModel={setSelectedModel}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={setSelectedModel}
          modelCounts={modelCounts}
          totalActive={displayedAircraft.length}
          manufacturers={manufacturers}
          onAircraftUpdate={handleAircraftUpdate}
          onModelsUpdate={handleModelsUpdate}
          onReset={handleReset}
          onError={handleError}
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
