import React, { useState, useMemo } from 'react';
import UnifiedSelector from '../../selector/UnifiedSelector';
import 'leaflet/dist/leaflet.css';
import MapComponent from '../Map/MapComponent';

interface Aircraft {
  icao24: string;
  latitude: number;
  longitude: number;
  model?: string;
  manufacturer?: string;
  operator?: string;
  "N-NUMBER"?: string;
  TYPE_AIRCRAFT: string;
}

const MapWrapper: React.FC = () => {
  const [state, setState] = useState({
    aircraft: [],
    isLoading: false,
    error: null,
    selectedManufacturer: '',
    activeIcao24s: new Set<string>(),
  });

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [activeCount, setActiveCount] = useState(0);

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    state.aircraft.forEach((plane: Aircraft) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [state.aircraft]);

  const handleManufacturerSelect = async (manufacturer: string) => {
    try {
      const response = await fetch('/api/aircraft/track-manufacturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        selectedManufacturer: manufacturer,
        aircraft: data.liveAircraft,
        activeIcao24s: new Set(data.liveAircraft.map((a: Aircraft) => a.icao24)),
      }));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    const filteredAircraft = model
      ? state.aircraft.filter((aircraft: Aircraft) => aircraft.model === model)
      : state.aircraft;
    setActiveCount(filteredAircraft.length);
  };

  const handleAircraftUpdate = (filteredAircraft: Aircraft[]) => {
    setActiveCount(filteredAircraft.length);
  };

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          selectedType="manufacturer"
          selectedManufacturer={state.selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          modelCounts={modelCounts}
          totalActive={activeCount}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          onAircraftUpdate={handleAircraftUpdate}
          onReset={() => setState({ ...state, aircraft: [] })}
        />
      </div>

      <MapComponent aircraft={state.aircraft} />
    </div>
  );
};

export default MapWrapper;