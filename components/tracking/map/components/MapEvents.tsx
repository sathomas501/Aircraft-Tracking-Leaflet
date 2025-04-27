// components/tracking/map/components/MapEvents.tsx
import React from 'react';
import { useMapEvents } from 'react-leaflet';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import { useEnhancedUI } from '../../context/EnhancedUIContext';

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

export default MapEvents;
