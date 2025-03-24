// components/tracking/map/EnhancedReactBaseMap.tsx
import React, { useEffect } from 'react';
import {
  MapContainer,
  useMapEvents,
  TileLayer,
  useMap,
  LayersControl,
  ZoomControl,
} from 'react-leaflet';
import { MAP_CONFIG } from '@/config/map';
import EnhancedContextAircraftInfoPanel from './components/EnhancedContextAircraftInfoPanel';
import EnhancedContextAircraftMarker from '../map/EnhancedContextAircraftMarker';
import EnhancedContextMapControls from './components/EnhancedContextMapControls';
import TrailToggle from './components/TrailToggle';
import LeafletTouchFix from './components/LeafletTouchFix'; // Import the touch fix component
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { ExtendedAircraft } from '@/types/base';
import MapControllerWithOptions from './MapControllerWithOptions';
import L from 'leaflet';

const MapEvents: React.FC = () => {
  const { setZoomLevel } = useEnhancedMapContext();

  // Use useMapEvents hook to handle map events
  const map = useMapEvents({
    zoomend: () => {
      const zoom = map.getZoom();
      setZoomLevel(zoom);
    },
  });

  return null;
};

// Inner component to connect the map instance to context
const MapControllerInner: React.FC = () => {
  const { setMapInstance } = useEnhancedMapContext();
  const map = useMap();

  useEffect(() => {
    console.log('[EnhancedReactBaseMap] Registering map with context');
    setMapInstance(map);

    // Apply Leaflet fixes to prevent flickering
    const fixLeafletInteractions = () => {
      // Ensure all marker interactions are properly disabled
      document.querySelectorAll('.leaflet-marker-icon').forEach((marker) => {
        marker.classList.remove('leaflet-interactive');
        if (marker instanceof HTMLElement) {
          marker.style.pointerEvents = 'none';
        }
      });
    };

    // Apply fixes immediately and after map interactions
    fixLeafletInteractions();
    map.on('moveend', fixLeafletInteractions);
    map.on('zoomend', fixLeafletInteractions);

    return () => {
      console.log('[EnhancedReactBaseMap] Cleaning up map registration');
      setMapInstance(null);
      map.off('moveend', fixLeafletInteractions);
      map.off('zoomend', fixLeafletInteractions);
    };
  }, [map, setMapInstance]);

  return null;
};

// Props interface
export interface ReactBaseMapProps {
  onError: (message: string) => void;
}

const EnhancedReactBaseMap: React.FC<ReactBaseMapProps> = ({ onError }) => {
  const { displayedAircraft, isRefreshing, setZoomLevel } =
    useEnhancedMapContext();

  // Filter aircraft with valid coordinates
  const validAircraft = displayedAircraft.filter(
    (plane) =>
      typeof plane.latitude === 'number' &&
      typeof plane.longitude === 'number' &&
      !isNaN(plane.latitude) &&
      !isNaN(plane.longitude)
  );

  // Handle zoom change to update context
  const handleZoomChange = (map: L.Map) => {
    setZoomLevel(map.getZoom());
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={false}
        // Fix: Remove the options that aren't in MapContainer props
        // Use the options below in useEffect after getting the map instance
        // tap={false}
        // dragging={true}
        // trackResize={true}
        // preferCanvas={true}
        // renderer={L.canvas()}
      >
        <MapControllerWithOptions />
        <MapControllerInner />
        <MapEvents />
        <ZoomControl position="bottomright" />
        <LeafletTouchFix />
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
        {validAircraft.map((aircraft: ExtendedAircraft) => (
          <EnhancedContextAircraftMarker
            key={aircraft.icao24}
            aircraft={aircraft}
          />
        ))}
        {/* Map Controls */}
        <EnhancedContextMapControls />
        {/* Add the Trail Toggle component */}
        <TrailToggle />
      </MapContainer>

      {/* Selected aircraft info panel */}
      <EnhancedContextAircraftInfoPanel />
    </div>
  );
};

export default EnhancedReactBaseMap;
