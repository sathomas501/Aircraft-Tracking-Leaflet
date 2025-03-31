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
import L from 'leaflet';
import EnhancedUnifiedSelector from '../selector/EnhancedUnifiedSelector';
import type { SelectOption } from '@/types/base';
import UnifiedAircraftMarker from './UnifiedAircraftMarker';
import { useEnhancedUI } from '../../tracking/context/EnhancedUIContext';
import DraggablePanel from '../DraggablePanel';
import EnhancedTooltip from '../map/components/AircraftTooltip';
import EnhancedTrailSystem from '../../tracking/map/components/EnhancedTrailSystem';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import openSkyTrackingService from '../../../lib/services/openSkyTrackingService';
import 'leaflet/dist/leaflet.css';
import AircraftLookupTabs from '../../geofencing/AircraftLookupTabs';

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
  const { displayedAircraft, isRefreshing, setZoomLevel } =
    useEnhancedMapContext();
  const {
    selectAircraft,
    openPanel,
    closePanel,
    panels,
    isLoading,
    trailSettings,
    updateTrailSettings,
    toggleTrails,
  } = useEnhancedUI();

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

  // Handle trail settings change
  const handleTrailSettingsChange = (settings: {
    maxTrailLength: number;
    fadeTime: number;
    selectedOnly: boolean;
  }) => {
    // Update UI context settings
    updateTrailSettings(settings);

    // Also update the tracking service settings
    openSkyTrackingService.setMaxTrailLength(settings.maxTrailLength);
  };

  // Handle trail toggle
  const handleToggleTrails = () => {
    // Toggle trails in UI context
    toggleTrails();

    // Also toggle in tracking service
    const newState = !openSkyTrackingService.areTrailsEnabled();
    openSkyTrackingService.setTrailsEnabled(newState);

    // Force generate trails if enabling
    if (newState) {
      openSkyTrackingService.forceGenerateTrails();
    }
  };

  // Force refresh trails
  const handleRefreshTrails = () => {
    openSkyTrackingService.forceGenerateTrails();
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

        {/* Aircraft trails - only render if enabled */}
        {trailSettings.enabled && (
          <EnhancedTrailSystem
            maxTrailLength={trailSettings.maxTrailLength}
            fadeTime={trailSettings.fadeTime}
            selectedOnly={trailSettings.selectedOnly}
          />
        )}

        {/* Aircraft markers using our unified marker component */}
        {validAircraft.map((aircraft: ExtendedAircraft) => (
          <UnifiedAircraftMarker
            key={aircraft.icao24}
            aircraft={aircraft}
            onMarkerClick={handleMarkerClick}
          />
        ))}
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

      {/* Custom panel for trail settings */}
      {panels.custom.isOpen && panels.custom.customContent && (
        <DraggablePanel
          isOpen={panels.custom.isOpen}
          onClose={() => closePanel('custom')}
          title={panels.custom.title || 'Custom Panel'}
          initialPosition={panels.custom.position}
          className="bg-white rounded-lg shadow-lg"
        >
          {panels.custom.customContent}
        </DraggablePanel>
      )}

      {/* Manufacturer filter using our draggable panel */}
      {manufacturers.length > 0 && (
        <div className="absolute top-5 left-5 z-50">
          <AircraftLookupTabs manufacturers={manufacturers} />
        </div>
      )}
    </div>
  );
};

export default EnhancedReactBaseMap;
