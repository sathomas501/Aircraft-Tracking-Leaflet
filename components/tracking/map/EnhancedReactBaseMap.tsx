// components/tracking/map/EnhancedReactBaseMap.tsx
import React, { useEffect, useState } from 'react';
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
import LeafletTouchFix from './components/LeafletTouchFix'; // Import the touch fix component
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { ExtendedAircraft } from '@/types/base';
import MapControllerWithOptions from './MapControllerWithOptions';
import L from 'leaflet';
import EnhancedUnifiedSelector from '../selector/EnhancedUnifiedSelector';
import type { SelectOption } from '@/types/base';
import 'leaflet/dist/leaflet.css'; // Make sure this is imported!

// In your EnhancedReactBaseMap.tsx
const MapEvents: React.FC = () => {
  const { setZoomLevel } = useEnhancedMapContext();

  const map = useMapEvents({
    zoomend: () => {
      const zoom = map.getZoom();
      console.log('Map zoomed to level:', zoom); // Add this for debugging
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
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const { displayedAircraft, isRefreshing, setZoomLevel } =
    useEnhancedMapContext();

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        const response = await fetch('/api/tracking/manufacturers');
        const data = await response.json();
        setManufacturers(data);
      } catch (error) {
        onError('Failed to load manufacturers');
      }
    };

    fetchManufacturers();
  }, [onError]);

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

  // In EnhancedReactBaseMap.tsx
  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapControllerWithOptions />
        <MapControllerInner />
        <MapEvents />
        <ZoomControl position="bottomright" />
        <LeafletTouchFix />
        <LayersControl position="topright">{/* Layer options */}</LayersControl>

        {/* Aircraft markers */}
        {validAircraft.map((aircraft: ExtendedAircraft) => (
          <EnhancedContextAircraftMarker
            key={aircraft.icao24}
            aircraft={aircraft}
          />
        ))}
      </MapContainer>

      {/* UI Components - positioned with inline styles for reliability */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 9999,
          background: 'white',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      ></div>

      {manufacturers.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 9999,
          }}
        >
          <EnhancedUnifiedSelector manufacturers={manufacturers} />
        </div>
      )}

      {/* Aircraft info panel */}
      <EnhancedContextAircraftInfoPanel />
    </div>
  );
};

export default EnhancedReactBaseMap;
