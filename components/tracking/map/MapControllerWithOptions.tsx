// components/tracking/map/MapControllerWithOptions.tsx
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import L from 'leaflet';

const MapControllerWithOptions = () => {
  const { setMapInstance } = useEnhancedMapContext();
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Register map with context
    setMapInstance(map);

    // Apply advanced options that can't be set via props
    try {
      // Disable tap handler to prevent flickering
      // @ts-ignore - Accessing internal Leaflet property
      if (map.tap) {
        // @ts-ignore - Accessing internal Leaflet property
        map.tap.disable();
      }

      // Ensure dragging is enabled
      if (map.dragging) map.dragging.enable();

      // Try to use canvas renderer for better performance
      // @ts-ignore - Setting internal option
      map.options.preferCanvas = true;

      // Apply fixes to prevent flickering
      const fixLeafletInteractions = () => {
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
    } catch (error) {
      console.error('[MapControllerWithOptions] Error:', error);
    }

    return () => {
      setMapInstance(null);
      map.off('moveend');
      map.off('zoomend');
    };
  }, [map, setMapInstance]);

  return null;
};

export default MapControllerWithOptions;
