import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  MapContainer,
  TileLayer,
  useMap,
  LayersControl,
  ZoomControl,
  Marker,
} from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { MAP_CONFIG } from '@/config/map';
import L from 'leaflet';
import EnhancedContextAircraftMarker from '../map/EnhancedContextAircraftMarker';
import EnhancedContextMapControls from './components/EnhancedContextMapControls';
import EnhancedContextAircraftInfoPanel from './components/EnhancedContextAircraftInfoPanel';

// Inner component to connect the map instance to context
const MapControllerInner: React.FC<{
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
  onZoomChange?: (zoom: number) => void;
}> = ({ onBoundsChange, onZoomChange }) => {
  const { setMapInstance, setZoomLevel } = useEnhancedMapContext();
  const map = useMap();

  useEffect(() => {
    console.log('[EnhancedReactBaseMap] Registering map with context');
    setMapInstance(map);

    // Set initial zoom
    if (setZoomLevel) {
      setZoomLevel(map.getZoom());
    }

    // Handle zoom changes
    const handleZoom = () => {
      if (setZoomLevel) {
        setZoomLevel(map.getZoom());
      }
      if (onZoomChange) {
        onZoomChange(map.getZoom());
      }
    };

    // Handle bounds changes
    const handleMoveEnd = () => {
      if (onBoundsChange) {
        onBoundsChange(map.getBounds());
      }
    };

    map.on('zoomend', handleZoom);
    map.on('moveend', handleMoveEnd);

    // Initial calls
    handleZoom();
    handleMoveEnd();

    return () => {
      console.log('[EnhancedReactBaseMap] Cleaning up map registration');
      map.off('zoomend', handleZoom);
      map.off('moveend', handleMoveEnd);
      setMapInstance(null);
    };
  }, [map, setMapInstance, setZoomLevel, onZoomChange, onBoundsChange]);

  return null;
};

// Props interface
export interface ReactBaseMapProps {
  onError?: (message: string) => void;
}

const EnhancedReactBaseMap: React.FC<ReactBaseMapProps> = ({ onError }) => {
  const {
    displayedAircraft,
    isRefreshing,
    selectedAircraft,
    selectAircraft,
    setZoomLevel,
  } = useEnhancedMapContext();

  // Performance monitoring
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());

  // Map bounds state
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [currentZoom, setCurrentZoom] = useState(MAP_CONFIG.DEFAULT_ZOOM);

  // Monitor FPS
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;
      const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);

      setFps(currentFps);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }, 1000);

    // Animation frame counter
    const countFrame = () => {
      frameCountRef.current++;
      rafId = requestAnimationFrame(countFrame);
    };

    let rafId = requestAnimationFrame(countFrame);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Handle map events
  const handleBoundsChange = useCallback((bounds: L.LatLngBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleZoomChange = useCallback(
    (zoom: number) => {
      setCurrentZoom(zoom);
      if (setZoomLevel) {
        setZoomLevel(zoom);
      }
    },
    [setZoomLevel]
  );

  // Filter and limit aircraft based on performance
  const visibleAircraft = useMemo(() => {
    // Skip filtering if no bounds or low FPS
    if (!mapBounds || fps < 10) {
      // When performance is critical, show very few aircraft
      return displayedAircraft.slice(0, Math.min(5, displayedAircraft.length));
    }

    // Filter by map bounds with padding
    const paddedBounds = mapBounds.pad(0.2); // 20% padding

    return (
      displayedAircraft
        .filter((plane) =>
          paddedBounds.contains([plane.latitude, plane.longitude])
        )
        // Limit based on performance
        .slice(0, fps < 30 ? 10 : fps < 45 ? 30 : 100)
    );
  }, [displayedAircraft, mapBounds, fps]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        preferCanvas={true}
      >
        <MapControllerInner
          onBoundsChange={handleBoundsChange}
          onZoomChange={handleZoomChange}
        />
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

        {/* Render aircraft markers with limits based on performance */}
        {visibleAircraft.map((plane) => (
          <EnhancedContextAircraftMarker key={plane.icao24} aircraft={plane} />
        ))}
      </MapContainer>

      {/* Map Controls */}
      <EnhancedContextMapControls />

      {/* Performance indicator */}
      <div className="absolute top-4 right-4 z-50 bg-white px-4 py-2 rounded shadow">
        <div className="text-sm font-mono">
          FPS: {fps} {fps < 30 ? '⚠️' : '✅'}
        </div>
        <div className="text-xs">
          Rendering {visibleAircraft.length}/{displayedAircraft.length} aircraft
        </div>
      </div>

      {/* Selected aircraft info panel */}
      <EnhancedContextAircraftInfoPanel />
    </div>
  );
};

export default EnhancedReactBaseMap;
