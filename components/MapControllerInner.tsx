// components/tracking/map/components/MapControllerInner.tsx
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useEnhancedMapContext } from '../components/tracking/context/EnhancedMapContext';

interface MapControllerInnerProps {
  // You can add any additional props needed
  // For example:
  disableInteractions?: boolean;
}

const MapControllerInner: React.FC<MapControllerInnerProps> = (props) => {
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

export default MapControllerInner;
