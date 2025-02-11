import React, { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import UnifiedSelector from '../../selector/UnifiedSelector';
import type {
  Aircraft,
  SelectOption,
  OpenSkyStateArray,
  TrackingData,
} from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { DynamicMapProps, ExtendedAircraft } from '../Map/DynamicMap';
import { debounce } from 'lodash';

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

  const handleManufacturerSelect = useCallback(
    debounce(async (selectedManufacturer: string) => {
      try {
        console.log('Manufacturer selected:', selectedManufacturer);
        setSelectedManufacturer(selectedManufacturer);

        // First try to get recent data from tracking database
        const trackingResponse = await fetch('/api/aircraft/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getTrackedAircraft',
            manufacturer: selectedManufacturer,
          }),
        });

        if (trackingResponse.ok) {
          const trackedData = await trackingResponse.json();

          if (trackedData.success && trackedData.aircraft?.length > 0) {
            const extendedAircraft: ExtendedAircraft[] =
              trackedData.aircraft.map((aircraft: Aircraft) => ({
                ...aircraft,
                type:
                  aircraft.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
                isGovernment: aircraft.OWNER_TYPE === '5',
              }));
            console.log(
              `Using ${extendedAircraft.length} cached aircraft positions for ${selectedManufacturer}`
            );
            setDisplayedAircraft(extendedAircraft);
            return; // Use cached data, don't poll OpenSky
          }
        }

        // If no recent data, then poll OpenSky
        console.log(
          `No recent data found for ${selectedManufacturer}, polling OpenSky...`
        );
        const icaoResponse = await fetch('/api/aircraft/icao24s', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manufacturer: selectedManufacturer }),
        });

        if (!icaoResponse.ok) {
          const errorData = await icaoResponse.json();
          throw new Error(
            errorData.message ||
              `Failed to fetch ICAO data: ${icaoResponse.statusText}`
          );
        }

        interface IcaoResponseData {
          success: boolean;
          data: {
            manufacturer: string;
            icao24List: string[];
            states: OpenSkyStateArray[];
            meta: {
              total: number;
              timestamp: string;
              batches: number;
            };
          };
        }

        const icaoData: IcaoResponseData = await icaoResponse.json();

        if (
          !icaoData.success ||
          !icaoData.data ||
          !Array.isArray(icaoData.data.states)
        ) {
          throw new Error('Invalid response format from ICAO endpoint');
        }

        // Send the states to tracking for persistence
        console.log('Raw OpenSky response:', icaoData);

        const trackingData = icaoData.data.states
          .map((state) => ({
            icao24: state[0] ?? null,
            latitude: state[6] ?? null,
            longitude: state[5] ?? null,
            altitude: state[7] ?? null,
            velocity: state[9] ?? null,
            heading: state[10] ?? null,
            on_ground: state[8] ?? null,
            last_contact: state[4] ?? null,
            updated_at: Date.now(),
          }))
          .filter(
            (aircraft) =>
              aircraft.icao24 !== null &&
              aircraft.latitude !== null &&
              aircraft.longitude !== null
          );

        console.log('Filtered trackingData before sending:', trackingData);

        if (trackingData.length === 0) {
          console.error(
            '[MapWrapper] No valid tracking data available. Skipping API request.'
          );
          return;
        }

        const trackingUpdateResponse = await fetch('/api/aircraft/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsertActiveAircraftBatch',
            trackingData,
          }),
        });

        console.log(
          'Tracking update response:',
          await trackingUpdateResponse.json()
        );

        // Transform the aircraft data for display
        const extendedAircraft: ExtendedAircraft[] = icaoData.data.states.map(
          (state: OpenSkyStateArray) => ({
            icao24: state[0],
            'N-NUMBER': '',
            manufacturer: selectedManufacturer,
            model: '',
            operator: '',
            latitude: state[6],
            longitude: state[5],
            altitude: state[7],
            heading: state[10],
            velocity: state[9],
            on_ground: state[8],
            last_contact: state[4],
            NAME: '',
            CITY: '',
            STATE: '',
            OWNER_TYPE: '',
            TYPE_AIRCRAFT: '',
            isGovernment: false,
            type: 'Non-Government',
            isTracked: true,
          })
        );

        console.log(
          `Retrieved ${extendedAircraft.length} new positions from OpenSky for ${selectedManufacturer}`
        );
        setDisplayedAircraft(extendedAircraft);
      } catch (error) {
        console.error('Failed to fetch aircraft:', error);
        onError(
          error instanceof Error ? error.message : 'Failed to fetch aircraft'
        );
      }
    }, 300),
    []
  );

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
