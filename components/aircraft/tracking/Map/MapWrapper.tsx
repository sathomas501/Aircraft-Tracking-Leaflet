import React, { useState, useMemo, useEffect } from 'react';
import MapComponent from '../Map/MapComponent';
import UnifiedSelector from '../../selector/UnifiedSelector';
import { manufacturerTracking } from '@/lib/services/manufacturer-tracking-service';
import type { Aircraft } from '@/types/base';

interface State {
  aircraft: Aircraft[];
  isLoading: boolean;
  error: string | null;
  selectedManufacturer: string;
}

const MapWrapper: React.FC = () => {
  const [state, setState] = useState<State>({
    aircraft: [],
    isLoading: false,
    error: null,
    selectedManufacturer: '',
  });

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [mapKey, setMapKey] = useState(0); // Add key for forcing map re-render

  // Debug logging for aircraft state changes
  useEffect(() => {
    console.log('Aircraft state updated:', {
      count: state.aircraft.length,
      sample: state.aircraft.slice(0, 2)
    });
  }, [state.aircraft]);

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
        isLoading: false,
      }));

      // Start tracking the aircraft
      manufacturerTracking.startPolling(data.icao24List.map((icao24: string) => ({ icao24 })));
    } catch (error) {
      console.error('Error:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load aircraft data.',
        isLoading: false,
      }));
    }
  };

  const handleAircraftUpdate = (data: Aircraft[] | { aircraft: Aircraft[] }) => {
    console.log('Received aircraft update:', data);
    
    let aircraftData: Aircraft[] = Array.isArray(data) ? data : data.aircraft;
    
    if (!aircraftData || !Array.isArray(aircraftData)) {
      console.error('Invalid aircraft data received');
      return;
    }

    // Filter out aircraft without valid coordinates
    aircraftData = aircraftData.filter(aircraft => 
      typeof aircraft.latitude === 'number' && 
      typeof aircraft.longitude === 'number' &&
      aircraft.latitude !== 0 &&
      aircraft.longitude !== 0
    );

    setState(prev => ({
      ...prev,
      aircraft: aircraftData.map(aircraft => ({
        ...aircraft,
        manufacturer: state.selectedManufacturer,
        isTracked: true,
        // Ensure required fields have default values
        model: aircraft.model || '',
        "N-NUMBER": aircraft["N-NUMBER"] || '',
        NAME: aircraft.NAME || '',
        CITY: aircraft.CITY || '',
        STATE: aircraft.STATE || '',
        OWNER_TYPE: aircraft.OWNER_TYPE || '',
        TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || '',
        heading: aircraft.heading || aircraft.heading || 0,
        altitude: aircraft.altitude || aircraft.altitude || 0,
        velocity: aircraft.velocity || 0,
        on_ground: aircraft.on_ground || false,
        last_contact: aircraft.last_contact || 0,
        icao24: aircraft.icao24
      }))
    }));

    // Force map to re-render with new data
    setMapKey(prev => prev + 1);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manufacturerTracking.stopPolling();
    };
  }, []);

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
        <MapComponent 
          key={mapKey}
          aircraft={state.aircraft} 
        />
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