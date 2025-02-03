import React, { useState, useMemo } from 'react';
import UnifiedSelector from '../../selector/UnifiedSelector';
import 'leaflet/dist/leaflet.css';
import MapComponent from '../Map/MapComponent';
import type { Aircraft } from '@/types/base';  // Import the shared Aircraft type

const MapWrapper: React.FC = () => {
  const [state, setState] = useState({
    aircraft: [] as Aircraft[],  // Use the imported Aircraft type
    isLoading: false,
    error: null as unknown,
    selectedManufacturer: '',
    activeIcao24s: new Set<string>(),
  });

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [activeCount, setActiveCount] = useState(0);
  const [displayedAircraft, setDisplayedAircraft] = useState<Aircraft[]>([]); // Use the imported Aircraft type

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
      setState(prev => ({ ...prev, isLoading: true })); // Add loading state
  
      const response = await fetch('/api/aircraft/track-manufacturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });
  
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (!data.liveAircraft || !Array.isArray(data.liveAircraft)) {
        throw new Error('Invalid API response format');
      }
  
      const newAircraft = data.liveAircraft as Aircraft[];
  
      setState(prev => ({
        ...prev,
        selectedManufacturer: manufacturer,
        aircraft: newAircraft,
        activeIcao24s: new Set(newAircraft.map(a => a.icao24)),
        isLoading: false,
      }));
  
      setDisplayedAircraft(newAircraft);
      setActiveCount(newAircraft.length);
    } catch (error) {
      console.error('Error:', error);
      setState(prev => ({ ...prev, isLoading: false, error: error as unknown }));
    }
  };
  

  const handleModelSelect = (model: string) => {
    console.log('[MapWrapper] Model selected:', model);
    setSelectedModel(model);
  };

  const handleAircraftUpdate = (updatedAircraft: Aircraft[]) => {
    console.log('[MapWrapper] Updating aircraft:', updatedAircraft.length);
    setState(prev => ({
      ...prev,
      aircraft: updatedAircraft
    }));
    setDisplayedAircraft(updatedAircraft);
    setActiveCount(updatedAircraft.length);
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
  updateModelCounts={() =>
    setState(prevState => ({ ...prevState, aircraft: [] }))
  }
  onReset={() => {
    setState(prevState => ({
      ...prevState,
      aircraft: [],
      selectedManufacturer: '',
      activeIcao24s: new Set(),
    }));
    setDisplayedAircraft([]);
  }}
/>
      </div>

      <MapComponent aircraft={displayedAircraft} />
    </div>
  );
};

export default MapWrapper;