import React, { useState, useMemo, useEffect } from 'react';
import MapComponent from '../Map/MapComponent';
import UnifiedSelector from '../../selector/UnifiedSelector';
import { manufacturerTracking } from '@/lib/services/manufacturer-tracking-service';
import { toast } from 'react-toastify'; // Add toast notification library
import type { Aircraft } from '@/types/base';

interface TrackingData {
  aircraft: Array<{
    icao24: string;
    callsign?: string;
    origin_country?: string;
    time_position?: number;
    last_contact?: number;
    longitude?: number;
    latitude?: number;
    baro_altitude?: number;
    on_ground?: boolean;
    velocity?: number;
    true_track?: number;
    vertical_rate?: number;
    sensors?: number[];
    geo_altitude?: number;
    squawk?: string;
    spi?: boolean;
    position_source?: number;
  }>;
}

interface State {
  aircraft: Aircraft[];
  isLoading: boolean;
  error: string | null;
  selectedManufacturer: string;
}

const userFriendlyErrors: Record<string, string> = {
  NETWORK: 'Network error: Please check your connection.',
  DATA: 'Error fetching aircraft data. Please try again.',
  DEFAULT: 'An unexpected error occurred. Please try again later.',
};

const MapWrapper: React.FC = () => {
  const [state, setState] = useState<State>({
    aircraft: [],
    isLoading: false,
    error: null,
    selectedManufacturer: '',
  });

  const [selectedModel, setSelectedModel] = useState<string>('');

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    state.aircraft.forEach((plane) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [state.aircraft]);

  useEffect(() => {
    const subscription = manufacturerTracking.subscribe((data: TrackingData) => {
      handleAircraftUpdate(data);
    });

    return () => {
      subscription.unsubscribe();
      manufacturerTracking.stopPolling();
    };
  }, []);

  const handleAircraftUpdate = (data: TrackingData) => {
    if (!data.aircraft) {
      console.error('Invalid aircraft data received');
      toast.error(userFriendlyErrors.DATA);
      return;
    }

    setState((prev) => ({
      ...prev,
      aircraft: data.aircraft.map((aircraftData) => ({
        ...aircraftData,
        model: '',
        "N-NUMBER": '',
        manufacturer: state.selectedManufacturer,
        NAME: '',
        CITY: '',
        STATE: '',
        OWNER_TYPE: '',
        TYPE_AIRCRAFT: '',
        isTracked: true,
        heading: aircraftData.true_track || 0,
        latitude: aircraftData.latitude || 0,
        longitude: aircraftData.longitude || 0,
        altitude: aircraftData.baro_altitude || 0,
        velocity: aircraftData.velocity || 0,
        on_ground: aircraftData.on_ground || false,
        last_contact: aircraftData.last_contact || 0,
        icao24: aircraftData.icao24,
      })),
    }));
  };

  const handleManufacturerSelect = async (manufacturer: string) => {
    if (!manufacturer) {
      toast.error('No manufacturer selected.');
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || userFriendlyErrors.NETWORK);
      }

      if (!responseData.icao24List) {
        throw new Error(userFriendlyErrors.DATA);
      }

      const formattedIcao24s = responseData.icao24List.map((icao24: string) => ({
        icao24: icao24.toLowerCase(),
      }));

      await manufacturerTracking.startPolling(formattedIcao24s);

      setState((prev) => ({
        ...prev,
        selectedManufacturer: manufacturer,
        isLoading: false,
      }));

      toast.success('Manufacturer aircraft data loaded successfully.');
    } catch (error) {
      console.error('Error in handleManufacturerSelect:', error);
      manufacturerTracking.stopPolling();
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : userFriendlyErrors.DEFAULT,
        isLoading: false,
      }));
      toast.error(
        error instanceof Error ? error.message : userFriendlyErrors.DEFAULT
      );
    }
  };

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          selectedType="manufacturer"
          selectedManufacturer={state.selectedManufacturer}
          selectedModel={selectedModel}
          modelCounts={modelCounts}
          totalActive={state.aircraft.length}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={setSelectedModel}
          onAircraftUpdate={handleAircraftUpdate}
        />
      </div>

      <div className="absolute inset-0 z-0">
        {!state.isLoading && <MapComponent aircraft={state.aircraft} />}
      </div>

      {state.isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="text-white">Loading aircraft data...</div>
        </div>
      )}
    </div>
  );
};

export default MapWrapper;