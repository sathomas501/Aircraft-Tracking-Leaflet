// Map/BaseMap.tsx
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, LayersControl } from 'react-leaflet';
import { useMapContext } from '@/components/tracking/context/MapContext';
import { useMapControl } from '@/components/tracking/context/useMapControl';
import AircraftMarker from './components/AircraftMarker';
import MapControls from './components/MapControls';
import AircraftInfoPanel from './components/AircraftInfoPanel';
import { MAP_CONFIG } from '@/config/map';

// Helper component to register the map instance
const MapController: React.FC = () => {
  const map = useMap();
  const { registerMap } = useMapControl();

  useEffect(() => {
    return registerMap(map);
  }, [map, registerMap]);

  return null;
};

const BaseMap: React.FC = () => {
  const { aircraft, selectedAircraft, selectAircraft } = useMapContext();

  return (
    <div className="map-fixed-container">
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <MapController />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="© Esri"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Aircraft markers */}
        {aircraft.map((plane) => (
          <AircraftMarker
            key={plane.icao24}
            aircraft={plane}
            isSelected={selectedAircraft?.icao24 === plane.icao24}
            onClick={() => selectAircraft(plane)}
          />
        ))}

        <MapControls />
      </MapContainer>

      {selectedAircraft && (
        <AircraftInfoPanel
          aircraft={selectedAircraft}
          onClose={() => selectAircraft(null)}
        />
      )}
    </div>
  );
};

export default BaseMap;
