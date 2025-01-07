import React, { useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import UnifiedSelector from './../selector/UnifiedSelector';
import { AircraftDisplay } from '../AircraftDisplay';
import type { Aircraft, Position, Trails, PositionData, SelectOption } from '@/types/types';

import 'leaflet/dist/leaflet.css';

const CONTINENTAL_US_BOUNDS: [[number, number], [number, number]] = [
  [24.396308, -125.0], // Southwest corner
  [49.384358, -66.93457], // Northeast corner
];

const LeafletMap: React.FC = () => {
  const [state, setState] = useState({
    selectedManufacturer: '',
    selectedModel: '',
    selectedType: '',
    selectedAircraftId: null as string | null,
    livePositions: {} as PositionData,
    updateError: null as string | null,
    fetchEnabled: true,
    trails: {} as Trails,
  });

  const manufacturersList = [
    { value: 'boeing', label: 'Boeing', count: 50 },
    { value: 'airbus', label: 'Airbus', count: 30 },
  ];

  const FitToBounds = () => {
    const map = useMap();

    React.useEffect(() => {
      map.fitBounds(CONTINENTAL_US_BOUNDS, { padding: [20, 20] });
    }, [map]);

    return null;
  };

  const handleManufacturerChange = useCallback((manufacturer: string) => {
    setState((prev) => ({
      ...prev,
      selectedManufacturer: manufacturer,
      selectedModel: '',
    }));
  }, []);

  const handleModelChange = useCallback((model: string) => {
    setState((prev) => ({ ...prev, selectedModel: model }));
  }, []);

  return (
    <div className="relative flex flex-col space-y-4 w-full">
      {/* Selector */}
      <div className="sticky top-0 z-50 bg-white pb-4">
        <UnifiedSelector
          selectedType={state.selectedType}
          onManufacturerSelect={handleManufacturerChange}
          onModelSelect={handleModelChange}
          selectedManufacturer={state.selectedManufacturer}
          selectedModel={state.selectedModel}
        />
      </div>

      {/* Error display */}
      {state.updateError && (
        <div className="relative z-40 p-4 bg-red-100 text-red-700 rounded-lg">
          {state.updateError}
        </div>
      )}

      {/* Map Container */}
      <div className="relative h-[800px] w-full bg-gray-100 rounded-lg overflow-hidden">
        <MapContainer
          bounds={CONTINENTAL_US_BOUNDS}
          className="w-full h-full z-0"
          zoomControl={false}
        >
          <FitToBounds />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ZoomControl position="topright" />

          {manufacturersList.map((aircraft: SelectOption) => {
            const position = state.livePositions[aircraft.value];
            if (!position?.latitude || !position?.longitude) return null;

            const aircraftData: Aircraft = {
              icao24: aircraft.value,
              "N-NUMBER": '',
              manufacturer: aircraft.label,
              model: '',
              operator: '',
              NAME: '',
              CITY: '',
              STATE: '',
              latitude: position.latitude,
              longitude: position.longitude,
              velocity: position.velocity,
              heading: position.heading,
              altitude: position.altitude,
              on_ground: position.on_ground,
              last_contact: position.last_contact,
              isTracked: true,
            };

            return (
              <Marker
                key={aircraft.value}
                position={[position.latitude, position.longitude]}
                icon={L.divIcon({
                  className: 'aircraft-marker',
                  html: `
                    <div class="aircraft-icon ${
                      position.on_ground ? 'grounded' : ''
                    } ${
                      state.selectedAircraftId === aircraft.value
                        ? 'selected'
                        : ''
                    }">
                      <img 
                        src="${
                          position.on_ground
                            ? '/aircraft-pin.png'
                            : '/aircraft-pin-blue.png'
                        }"
                        style="transform: rotate(${position.heading || 0}deg)"
                        alt="Aircraft marker"
                      />
                    </div>
                  `,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <AircraftDisplay aircraft={aircraftData} displayMode="popup" />
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default LeafletMap;
