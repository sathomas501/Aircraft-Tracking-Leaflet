import React, { useState, useMemo } from 'react';
import  UnifiedSelector  from '../../selector/UnifiedSelector';
import MapComponent from '../Map/MapComponent';
import type { Aircraft, TrackingData } from '@/types/base';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/icons/aircraft-jet.png',
  iconUrl: '/icons/aircraft-jet.png',
  shadowUrl: ''
});



interface State {
  aircraft: Aircraft[];
  isLoading: boolean;
  error: string | null;
  selectedManufacturer: string;
  activeIcao24s: Set<string>;
}

const MapWrapper: React.FC = () => {
  const [state, setState] = useState<State>({
    aircraft: [],
    isLoading: false,
    error: null,
    selectedManufacturer: '',
    activeIcao24s: new Set<string>()
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

  const handleReset = () => {
    setState({
      aircraft: [],
      isLoading: false,
      error: null,
      selectedManufacturer: '',
      activeIcao24s: new Set<string>()
    });
    setSelectedModel('');
    setActiveCount(0);
  };

  const handleManufacturerSelect = async (manufacturer: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
        const response = await fetch('/api/aircraft/track-manufacturer', {  // Changed endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manufacturer }),
        });

        if (!response.ok) throw new Error('Failed to fetch aircraft data.');

        const responseData = await response.json();
        if (!responseData.liveAircraft) throw new Error('Invalid data format received.');

        // Map the live aircraft data correctly
        const mappedAircraft = responseData.liveAircraft.map((aircraft: Aircraft) => ({
            ...aircraft,
            manufacturer, // Ensure manufacturer is set
            isTracked: true,
            // Set required fields if not present
            "N-NUMBER": aircraft["N-NUMBER"] || "",
            NAME: aircraft.NAME || "",
            CITY: aircraft.CITY || "",
            STATE: aircraft.STATE || "",
            TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || "Unknown",
            OWNER_TYPE: aircraft.OWNER_TYPE || "Unknown",
            model: aircraft.model || "Unknown",
            operator: aircraft.operator || "Unknown"
        }));

        setState(prev => ({
          ...prev,
          selectedManufacturer: manufacturer,
          aircraft: responseData.liveAircraft,
          isLoading: false,
          activeIcao24s: new Set(responseData.liveAircraft.map((aircraft: Aircraft) => aircraft.icao24))
      }));

        setActiveCount(mappedAircraft.length);

    } catch (error) {
        setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to load aircraft data',
            isLoading: false
        }));
    }
};

const handleAircraftUpdate = (updateData: TrackingData) => {
  if (!updateData.aircraft || updateData.aircraft.length === 0) {
      console.warn("[MapWrapper] No aircraft updates received.");
      return;
  }

  console.log("[MapWrapper] Pre-mapping aircraft data:", updateData.aircraft[0]);

  setState(prev => {
      const liveAircraft = updateData.aircraft.map(aircraftData => {
          const mappedAircraft = {
              // Base tracking data
              icao24: aircraftData.icao24,
              latitude: aircraftData.latitude,
              longitude: aircraftData.longitude,
              altitude: aircraftData.altitude,
              velocity: aircraftData.velocity,
              heading: aircraftData.heading,
              on_ground: aircraftData.on_ground,
              last_contact: aircraftData.last_contact,
              lastSeen: aircraftData.lastUpdate,

              // Required Aircraft type fields
              "N-NUMBER": "",
              NAME: "",
              CITY: "",
              STATE: "",
              
              // Aircraft identification - Learjet specific
              TYPE_AIRCRAFT: '3',  // 3 = Jet Aircraft
              OWNER_TYPE: '2',     // 2 = Corporate
              manufacturer: prev.selectedManufacturer || 'LEARJET INC',
              isTracked: true
          };

          console.log("[MapWrapper] Mapped single aircraft:", {
              icao24: mappedAircraft.icao24,
              TYPE_AIRCRAFT: mappedAircraft.TYPE_AIRCRAFT,
              manufacturer: mappedAircraft.manufacturer
          });

          return mappedAircraft;
      });

      console.log("[MapWrapper] Post-mapping first aircraft:", liveAircraft[0]);

      setActiveCount(liveAircraft.length);

      return {
          ...prev,
          aircraft: liveAircraft,
          activeIcao24s: new Set(liveAircraft.map(a => a.icao24))
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
          setSelectedModel={setSelectedModel}
          modelCounts={modelCounts}
          totalActive={activeCount}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={setSelectedModel}
          onAircraftUpdate={handleAircraftUpdate}
          onReset={handleReset}
        />
      </div>

       {/* Map Component Rendering */}
       <div className="absolute inset-0 z-0">
                {!state.isLoading && (
                    <MapComponent aircraft={state.aircraft} />
                )}
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