// components/tracking/map/ContextEnabledReactBaseMap.tsx
import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  useMap,
  LayersControl,
  ZoomControl,
} from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { MAP_CONFIG } from '@/config/map';
import ContextAircraftMarker from './components/ContextAircraftMarker';
import ContextMapControls from './components/ContextMapControls';
import ContextAircraftInfoPanel from './components/ContextAircraftInfoPanel';

// Inner component to connect the map instance to context
const MapControllerInner: React.FC = () => {
  const { setMapInstance } = useEnhancedMapContext();
  const map = useMap();

  useEffect(() => {
    console.log('[ContextEnabledReactBaseMap] Registering map with context');
    setMapInstance(map);

    return () => {
      console.log('[ContextEnabledReactBaseMap] Cleaning up map registration');
      setMapInstance(null);
    };
  }, [map, setMapInstance]);

  return null;
};

// Props interface
export interface ReactBaseMapProps {
  onError: (message: string) => void;
}

const ContextEnabledReactBaseMap: React.FC<ReactBaseMapProps> = ({
  onError,
}) => {
  const { displayedAircraft, preserveView } = useEnhancedMapContext();

  // Filter aircraft with valid coordinates
  const validAircraft = displayedAircraft.filter(
    (plane) =>
      typeof plane.latitude === 'number' &&
      typeof plane.longitude === 'number' &&
      !isNaN(plane.latitude) &&
      !isNaN(plane.longitude)
  );

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={false}
      >
        <MapControllerInner />
        <ZoomControl position="bottomright" />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Topographic">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenTopoMap contributors"
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Render aircraft markers */}
        {validAircraft.map((plane) => (
          <ContextAircraftMarker key={plane.icao24} aircraft={plane} />
        ))}
      </MapContainer>

      {/* Map Controls */}
      <ContextMapControls />

      {/* Status message */}
      <div className="absolute bottom-20 left-4 z-20 bg-blue-100 text-blue-800 px-4 py-2 rounded shadow">
        Using Enhanced Context Map ({validAircraft.length} aircraft)
      </div>

      {/* Selected aircraft info panel */}
      <ContextAircraftInfoPanel />
    </div>
  );
};

export default ContextEnabledReactBaseMap;
