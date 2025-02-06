import React, { useState, useMemo, useEffect } from 'react';
import UnifiedSelector from '../../selector/UnifiedSelector';
import 'leaflet/dist/leaflet.css';
import type { Aircraft, SelectOption } from '@/types/base'; // Import the shared Aircraft type
import dynamic from 'next/dynamic';

const DynamicMap = dynamic(() => import('../Map/DynamicMap'), { ssr: false });

interface MapComponentProps {
  aircraft: Aircraft[]; // ✅ Define aircraft as a required prop
}

const MapWrapper: React.FC = () => {
  const [state, setState] = useState({
    aircraft: [] as Aircraft[], // Use the imported Aircraft type
    isLoading: false,
    error: null as unknown,
    selectedManufacturer: '',
    activeIcao24s: new Set<string>(),
  });

  const [activeCount, setActiveCount] = useState(0);
  const [displayedAircraft, setDisplayedAircraft] = useState<Aircraft[]>([]); // Use the imported Aircraft type
  const [selectedType, setSelectedType] = useState<string>(''); // Added
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>(''); // Added
  const [selectedModel, setSelectedModel] = useState<string>(''); // Added
  const [totalActive, setTotalActive] = useState<number>(0); // Added
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]); // Already exists?

  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    state.aircraft.forEach((plane: Aircraft) => {
      if (plane.model) {
        counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
      }
    });
    return counts;
  }, [state.aircraft]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fetchManufacturers = async () => {
        try {
          const response = await fetch('/api/manufacturers'); // Ensure this API exists
          const data = await response.json();
          setManufacturers(data.manufacturers || []);
        } catch (error) {
          console.error('Failed to fetch manufacturers:', error);
        }
      };

      fetchManufacturers();
    }
  }, []);

  const handleManufacturerSelect = async (manufacturer: string) => {
    try {
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch aircraft data: ${response.statusText}`
        );
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
      setSelectedManufacturer(manufacturer); // ✅ Use this instead
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
    setState((prev) => ({
      ...prev,
      aircraft: updatedAircraft,
    }));
    setDisplayedAircraft(updatedAircraft);
    setActiveCount(updatedAircraft.length);
  };

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <UnifiedSelector
          manufacturers={manufacturers}
          selectedType={selectedType}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          setSelectedManufacturer={setSelectedManufacturer} // ✅ Add this line
          setSelectedModel={setSelectedModel}
          modelCounts={modelCounts}
          totalActive={totalActive}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          onAircraftUpdate={handleAircraftUpdate}
          updateModelCounts={() =>
            setState((prevState) => ({ ...prevState, aircraft: [] }))
          }
          onReset={() => {
            setState((prevState) => ({
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
