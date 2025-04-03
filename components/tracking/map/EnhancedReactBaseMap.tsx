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
import LeafletTouchFix from './components/LeafletTouchFix';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { ExtendedAircraft } from '@/types/base';
import MapControllerWithOptions from './MapControllerWithOptions';
import SimplifiedAircraftMarker from './SimplifiedAircraftMarker';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import DraggablePanel from '../DraggablePanel';
import EnhancedTooltip from './components/AircraftTooltip';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import 'leaflet/dist/leaflet.css';
import UnifiedAircraftSelector from '../selector/UnifiedAircraftSelector';
import OwnershipColorKey from './components/OwnershipColorKey';
// Import the tooltip provider
import { AircraftTooltipProvider } from '../context/AircraftTooltipContext';
import type { SelectOption } from '@/types/base';

// Map Events component to handle zoom changes
const MapEvents: React.FC = () => {
  const { setZoomLevel } = useEnhancedMapContext();
  const { setIsLoading } = useEnhancedUI();

  const map = useMapEvents({
    zoomend: () => {
      const zoom = map.getZoom();
      console.log('Map zoomed to level:', zoom);
      setZoomLevel(zoom);
    },
    movestart: () => {
      setIsLoading(true);
    },
    moveend: () => {
      setIsLoading(false);
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
  const { displayedAircraft, isRefreshing, setZoomLevel, zoomLevel } =
    useEnhancedMapContext();

  const { selectAircraft, openPanel, closePanel, panels, isLoading } =
    useEnhancedUI();

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

  // Handle aircraft selection
  const handleMarkerClick = (aircraft: ExtendedAircraft) => {
    selectAircraft(aircraft);
  };

  // Handle opening the settings panel
  const handleOpenSettings = () => {
    openPanel('settings', null, { x: 20, y: 20 }, 'Map Settings');
  };

  return (
    <div className="relative w-full h-full">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-2 right-2 z-50 bg-white rounded-md py-1 px-3 shadow-md">
          <LoadingSpinner size="sm" message="Loading..." />
        </div>
      )}

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

        {/* Wrap aircraft markers with the tooltip provider */}
        <AircraftTooltipProvider>
          {/* Aircraft markers using our simplified marker component */}
          {validAircraft.map((aircraft: ExtendedAircraft) => (
            <SimplifiedAircraftMarker
              key={aircraft.ICAO24}
              aircraft={aircraft}
            />
          ))}
        </AircraftTooltipProvider>

        <div id="map" style={{ height: '100vh', width: '100%' }}>
          {/* Your map is rendered here */}
        </div>
        <OwnershipColorKey />
      </MapContainer>

      {/* UI Components using our unified system */}
      <div className="absolute bottom-5 left-5 z-50">
        <EnhancedTooltip content="Current status" position="top">
          <div className="bg-white p-2 rounded-md shadow-md">
            <span className="text-sm font-medium">
              {isRefreshing
                ? 'Refreshing...'
                : `${validAircraft.length} aircraft`}
            </span>
          </div>
        </EnhancedTooltip>
      </div>

      {/* Map controls */}

      {/* Settings panel */}
      {panels.settings.isOpen && (
        <DraggablePanel
          isOpen={panels.settings.isOpen}
          onClose={() => closePanel('settings')}
          title="Map Settings"
          initialPosition={panels.settings.position}
          className="bg-white rounded-lg shadow-lg"
        >
          <div className="p-4">
            <h3 className="font-medium mb-2">Display Options</h3>
            {/* Settings content would go here */}
          </div>
        </DraggablePanel>
      )}

      {/* Manufacturer filter using our draggable panel */}
      {manufacturers.length > 0 && (
        <div className="absolute top-5 left-5 z-50">
          <UnifiedAircraftSelector manufacturers={manufacturers} />
        </div>
      )}
    </div>
  );
};

export default EnhancedReactBaseMap;
