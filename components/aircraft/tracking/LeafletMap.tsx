import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { AircraftDisplay } from '../AircraftDisplay';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { UnifiedSelector } from '../selector/UnifiedSelector';
import { useAircraftData } from '@/hooks/useAircraftData';
import { openSkyClient } from '@/lib/opensky-client';
import type { Aircraft, Position, Trails, PositionData } from '@/types/types';


// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

interface LeafletMapProps {
  onAircraftCountChange?: (count: number) => void;
}

const RETRY_MAX = 3;
const TRAIL_LENGTH = 20;

export const LeafletMap: React.FC<LeafletMapProps> = ({ onAircraftCountChange }) => {
  const [state, setState] = useState({
    selectedManufacturer: '',
    selectedModel: '',
    selectedType: '',
    selectedAircraftId: null as string | null,
    nNumber: '',
    livePositions: {} as PositionData,
    lastUpdate: null as Date | null,
    trails: {} as Trails,
    updateError: null as string | null,
    fetchEnabled: true,
    retryCount: 0
  });

  const {
    data: { manufacturers = [], models = [] },
    isLoading,
    error: dataError,
    refetch
  } = useAircraftData(state.selectedManufacturer, state.selectedType);

  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleManufacturerChange = useCallback((manufacturer: string) => {
    updateState({
      selectedManufacturer: manufacturer,
      selectedModel: '',
      selectedAircraftId: null
    });
  }, [updateState]);

  const handleModelChange = useCallback((model: string) => {
    updateState({ selectedModel: model });
  }, [updateState]);

  return (
    <div className="relative flex flex-col space-y-4 w-full">
      {/* Selector with higher z-index */}
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
      {(dataError || state.updateError) && (
        <div className="relative z-40 p-4 bg-red-100 text-red-700 rounded-lg">
          {dataError?.toString() || state.updateError}
        </div>
      )}

      {/* Map container */}
      <div className="relative h-[800px] w-full bg-gray-100 rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
            <LoadingSpinner />
          </div>
        )}
        
        <MapContainer
  center={[34.7465, -92.2896]} // Centered over Arkansas
  zoom={14}  // Changed from 13 to 7 to show more of the state
  className="w-full h-full z-0"
  zoomControl={false}
>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ZoomControl position="topright" />
          
          {manufacturers.map((aircraft) => {
            const position = state.livePositions[aircraft.value];
            if (!position?.latitude || !position?.longitude) return null;

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
                      state.selectedAircraftId === aircraft.value ? 'selected' : ''
                    }">
                      <img 
                        src="${position.on_ground ? '/aircraft-pin.png' : '/aircraft-pin-blue.png'}"
                        style="transform: rotate(${position.heading || 0}deg)"
                        alt="Aircraft marker"
                      />
                    </div>
                  `,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <AircraftDisplay
                      aircraft={{
                        icao24: aircraft.value,
                        manufacturer: aircraft.label,
                        latitude: position.latitude,
                        longitude: position.longitude,
                        velocity: position.velocity,
                        heading: position.heading,
                        altitude: position.altitude,
                        on_ground: position.on_ground,
                        last_contact: position.last_contact,
                        isTracked: true
                      }}
                      displayMode="popup"
                    />
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