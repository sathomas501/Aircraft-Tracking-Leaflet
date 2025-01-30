import React, { useState, useMemo, useEffect } from 'react';
import MapComponent from '../Map/MapComponent';
import UnifiedSelector from '../../selector/UnifiedSelector';
import { manufacturerTracking } from '@/lib/services/manufacturer-tracking-service';
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

const MapWrapper: React.FC = () => {
  console.log('MapWrapper rendering');
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

  const handleManufacturerSelect = async (manufacturer: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch aircraft data.');
      }

      const data = await response.json();
      
      if (!data.icao24List) {
        throw new Error('Invalid data format received from server.');
      }

      setState((prev) => ({
        ...prev,
        selectedManufacturer: manufacturer,
        aircraft: data.icao24List,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load aircraft data.',
        isLoading: false,
      }));
    }
  };

  const handleAircraftUpdate = (data: TrackingData) => {
    console.log('Received aircraft update:', data.aircraft);
    if (!data.aircraft) {
      console.error('Invalid aircraft data received');
      return;
    }
  
    setState((prev) => {
      console.log('Updating state with aircraft:', data.aircraft);
      return {
        ...prev,
        aircraft: data.aircraft.map((aircraftData) => ({
          ...aircraftData,
          model: '', // Add required Aircraft properties
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
          icao24: aircraftData.icao24
        })),
      };
    });
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

      {state.error && (
        <div className="absolute top-4 left-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
          {state.error}
        </div>
      )}

      {state.isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="text-white">Loading aircraft data...</div>
        </div>
      )}
    </div>
  );
};

export default MapWrapper;