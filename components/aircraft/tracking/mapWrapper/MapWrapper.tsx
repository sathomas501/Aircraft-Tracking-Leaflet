<<<<<<< Updated upstream
import React, { useState, useMemo, useEffect } from 'react';
=======
import React, { useState, useMemo, useEffect, useCallback } from 'react';
>>>>>>> Stashed changes
import UnifiedSelector from '../../selector/UnifiedSelector';
import ManufacturerSelector from '../../selector/ManufacturerSelector'; // ✅ Import ManufacturerSelector
import ModelSelector from '../../selector/ModelSelector'; // ✅ Import ModelSelector
import NNumberSelector from '../../selector/nNumberSelector'; // ✅ Import NNumberSelector
import 'leaflet/dist/leaflet.css';
<<<<<<< Updated upstream
import type { Aircraft, SelectOption } from '@/types/base'; // Import the shared Aircraft type
import dynamic from 'next/dynamic';

const DynamicMap = dynamic(() => import('../Map/DynamicMap'), { ssr: false });

interface MapComponentProps {
  aircraft: Aircraft[]; // ✅ Define aircraft as a required prop
}

const MapWrapper: React.FC = () => {
  const [state, setState] = useState({
    aircraft: [] as Aircraft[], // Use the imported Aircraft type
=======
import type { Aircraft, SelectOption } from '@/types/base';
import dynamic from 'next/dynamic';
import { fetchAircraftByNNumber } from '../../selector/services/aircraftService'; // ✅ Ensure correct import
import { useAircraftData } from '../../customHooks/useAircraftData';

const DynamicMap = dynamic(() => import('../Map/DynamicMap'), { ssr: false });

const MapWrapper: React.FC = () => {
  const [state, setState] = useState({
    aircraft: [] as Aircraft[],
>>>>>>> Stashed changes
    isLoading: false,
    error: null as unknown,
    selectedManufacturer: '',
    activeIcao24s: new Set<string>(),
  });

<<<<<<< Updated upstream
  const [activeCount, setActiveCount] = useState(0);
  const [displayedAircraft, setDisplayedAircraft] = useState<Aircraft[]>([]); // Use the imported Aircraft type
  const [selectedType, setSelectedType] = useState<string>(''); // Added
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>(''); // Added
  const [selectedModel, setSelectedModel] = useState<string>(''); // Added
  const [totalActive, setTotalActive] = useState<number>(0); // Added
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]); // Already exists?
=======
  const [displayedAircraft, setDisplayedAircraft] = useState<Aircraft[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [totalActive, setTotalActive] = useState<number>(0);
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [nNumber, setNNumber] = useState<string>(''); // ✅ State for N-Number input
  const { activeCount, liveAircraft, loading, error } =
    useAircraftData(selectedManufacturer);
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
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
=======
    const fetchManufacturers = async () => {
      try {
        const response = await fetch('/api/manufacturers');
        const data = await response.json();
        if (!data.manufacturers) {
          throw new Error('Invalid response format');
        }
        setManufacturers(data.manufacturers);
        console.log(`Loaded ${data.manufacturers.length} manufacturers`);
      } catch (error) {
        console.error('Failed to fetch manufacturers:', error);
      }
    };

    fetchManufacturers();
>>>>>>> Stashed changes
  }, []);

  const handleManufacturerSelect = async (manufacturer: string) => {
    setSelectedManufacturer(manufacturer);
    try {
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

<<<<<<< Updated upstream
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
=======
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setDisplayedAircraft(data.aircraft);
      handleAircraftUpdate(data.aircraft);
>>>>>>> Stashed changes
    } catch (error) {
      console.error('Failed to fetch aircraft:', error);
    }
  };
<<<<<<< Updated upstream
=======

  useEffect(() => {
    console.log('[MapWrapper] Displayed Aircraft:', displayedAircraft);
  }, [displayedAircraft]);
>>>>>>> Stashed changes

  const handleModelSelect = (model: string) => {
    console.log('[MapWrapper] Model selected:', model);
    setSelectedModel(model);
    const filteredAircraft = state.aircraft.filter(
      (plane) => plane.model === model
    );
    setDisplayedAircraft(filteredAircraft);
    console.log(`[MapWrapper] Active aircraft count: ${activeCount}`); // ✅ No more setActiveCount
  };

  const handleAircraftUpdate = (updatedAircraft: Aircraft[]) => {
    console.log('[MapWrapper] Updating aircraft:', updatedAircraft.length);
    setState((prev) => ({
      ...prev,
      aircraft: updatedAircraft,
    }));
    setDisplayedAircraft(updatedAircraft);
    console.log(`[MapWrapper] Active aircraft count: ${activeCount}`); // ✅ Use activeCount from useAircraftData
  };

  const handleNNumberSearch = async (nNumber: string) => {
    try {
      const aircraftData = await fetchAircraftByNNumber(nNumber);
      if (!aircraftData || aircraftData.length === 0) {
        console.warn(`⚠️ No aircraft found for N-Number: ${nNumber}`);
      } else {
        console.log(
          `✈️ Retrieved aircraft for N-Number ${nNumber}:`,
          aircraftData
        );
        setDisplayedAircraft(aircraftData);
        console.log(`[MapWrapper] Active aircraft count: ${activeCount}`); // ✅ Use activeCount from useAircraftData
      }
    } catch (error) {
      console.error('Error fetching aircraft by N-Number:', error);
    }
  };

  return (
    <div className="relative w-full h-screen">
<<<<<<< Updated upstream
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
=======
      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4 space-y-2">
        {/* ✅ Integrated Manufacturer Selector */}
        <ManufacturerSelector
          selectedManufacturer={selectedManufacturer}
          onSelect={handleManufacturerSelect}
        />

        {/* ✅ Integrated Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedManufacturer={selectedManufacturer}
          modelCounts={modelCounts}
        />

        {/* ✅ Integrated N-Number Selector */}
        <NNumberSelector
          nNumber={nNumber}
          setNNumber={setNNumber}
          onSearch={handleNNumberSearch}
        />

        {/* ✅ Unified Selector (if still needed for extra options) */}
>>>>>>> Stashed changes
        <UnifiedSelector
          manufacturers={manufacturers}
          selectedType={selectedType}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
<<<<<<< Updated upstream
          setSelectedManufacturer={setSelectedManufacturer} // ✅ Add this line
=======
          setSelectedManufacturer={setSelectedManufacturer}
>>>>>>> Stashed changes
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
