import React, { useState, useMemo } from 'react';
import UnifiedSelector from '../../selector/UnifiedSelector';
import 'leaflet/dist/leaflet.css';
import DynamicMap from '../Map/DynamicMap';
import type { Aircraft } from '@/types/base';  // Import the shared Aircraft type
import type {mapStateToAircraft} from '@/utils/aircraft-helpers'
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
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch aircraft data: ${response.statusText}`);
      }
  
      const data = await response.json();
      if (!data.icao24List) {
        throw new Error('Invalid data format received from server.');
      }
  
      // Ensure data.icao24List is an array
      if (!Array.isArray(data.icao24List)) {
        throw new Error('Expected icao24List to be an array.');
      }
  
      // Example of handling the data
      setState((prev) => ({
        ...prev,
        selectedManufacturer: manufacturer,
        aircraft: data.icao24List,
      }));
    } catch (error) {
      console.error('Error in handleManufacturerSelect:', error);
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
      }));
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

      <DynamicMap aircraft={displayedAircraft} />

    </div>
  );
};

export default MapWrapper;