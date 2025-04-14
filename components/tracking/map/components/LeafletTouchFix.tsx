// components/tracking/map/LeafletTouchFix.tsx
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const LeafletTouchFix: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Simpler approach to fix marker flickering
    const fixMarkerEvents = () => {
      // Apply fixes to all marker elements
      document.querySelectorAll('.leaflet-marker-icon').forEach((marker) => {
        marker.classList.remove('leaflet-interactive');
        if (marker instanceof HTMLElement) {
          marker.style.pointerEvents = 'none';
        }
      });
    };

    // Apply fixes immediately and on map events
    fixMarkerEvents();
    map.on('moveend', fixMarkerEvents);
    map.on('zoomend', fixMarkerEvents);

    // Re-apply fixes periodically to catch any newly added markers
    const intervalId = setInterval(fixMarkerEvents, 1000);

    return () => {
      map.off('moveend', fixMarkerEvents);
      map.off('zoomend', fixMarkerEvents);
      clearInterval(intervalId);
    };
  }, [map]);

  return null;
};

export default LeafletTouchFix;
