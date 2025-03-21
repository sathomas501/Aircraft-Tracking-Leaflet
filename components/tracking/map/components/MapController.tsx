// components/tracking/Map/components/MapController.tsx
import React, { useEffect } from 'react';
import { useMapContext } from '../../context/MapContext';

/**
 * MapController component
 *
 * This component connects your existing Leaflet map instance
 * to our custom context system.
 */
const MapController: React.FC = () => {
  // This will only execute when the component is rendered inside a MapProvider
  const { setMapInstance, setZoomLevel } = useMapContext();

  useEffect(() => {
    console.log('[MapController] Attempting to find map instance');

    // For the initial implementation, we'll use window.__leafletMapInstance
    // as the simplest approach to access the map
    const checkForMapInstance = () => {
      if ((window as any).__leafletMapInstance) {
        console.log('[MapController] Found map instance on window');
        const map = (window as any).__leafletMapInstance;

        // Add this line to directly set a property on the map instance
        map._preserveView = true;

        // Register with context
        setMapInstance(map);
        setZoomLevel(map.getZoom());

        // Add event listeners
        const handleZoom = () => setZoomLevel(map.getZoom());
        map.on('zoomend', handleZoom);

        return true;
      }
      return false;
    };

    // Try immediately
    if (checkForMapInstance()) {
      return;
    }

    // If not found, set up a small polling mechanism
    // (We'll clear this once we find the instance)
    const interval = setInterval(() => {
      if (checkForMapInstance()) {
        clearInterval(interval);
      }
    }, 500);

    // Clean up on unmount
    return () => {
      clearInterval(interval);

      // If we had registered with a map, clean up listeners
      if ((window as any).__leafletMapInstance) {
        const map = (window as any).__leafletMapInstance;
        map.off('zoomend');
        setMapInstance(null);
      }
    };
  }, [setMapInstance, setZoomLevel]);

  // This component doesn't render anything visible
  return null;
};

export default MapController;
