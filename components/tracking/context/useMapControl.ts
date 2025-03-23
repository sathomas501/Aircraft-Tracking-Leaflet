// components/tracking/context/useMapControl.ts
import { useEffect, useCallback, useRef } from 'react';
import { useEnhancedMapContext } from './EnhancedMapContext';
import type { Map as LeafletMap } from 'leaflet';

/**
 * Custom hook for controlling and interacting with the map
 * Provides methods to register the map instance and handle map events
 */
export function useMapControl() {
  const { setMapInstance, setZoomLevel, preserveView, selectedAircraft } =
    useEnhancedMapContext();

  const mapRef = useRef<LeafletMap | null>(null);

  // Register the map instance with the context
  const registerMap = useCallback(
    (map: LeafletMap) => {
      mapRef.current = map;
      setMapInstance(map);

      // Set up event listeners
      const handleZoom = () => {
        setZoomLevel(map.getZoom());
      };

      map.on('zoomend', handleZoom);

      // Initial zoom level
      setZoomLevel(map.getZoom());

      // Return cleanup function
      return () => {
        map.off('zoomend', handleZoom);
        setMapInstance(null);
        mapRef.current = null;
      };
    },
    [setMapInstance, setZoomLevel]
  );

  // Handle auto-fitting bounds for aircraft
  const fitToBounds = useCallback(
    (bounds: any, options = {}) => {
      if (!mapRef.current || preserveView) return;

      mapRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 10,
        ...options,
      });
    },
    [preserveView]
  );

  // Focus on selected aircraft
  useEffect(() => {
    if (!mapRef.current || !selectedAircraft) return;

    if (selectedAircraft.latitude && selectedAircraft.longitude) {
      mapRef.current.panTo([
        selectedAircraft.latitude,
        selectedAircraft.longitude,
      ]);
    }
  }, [selectedAircraft]);

  return {
    registerMap,
    fitToBounds,
    // Add the current map instance ref for convenience
    mapRef,
  };
}

export default useMapControl;
