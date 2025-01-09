// components/aircraft/tracking/Map/LeafletMap/components/FitToBounds.tsx
import React from 'react';
import { useMap } from 'react-leaflet';
import { CONTINENTAL_US_BOUNDS } from '@/constants/map';

export const FitToBounds: React.FC = () => {
  const map = useMap();
  
  React.useEffect(() => {
    map.fitBounds(CONTINENTAL_US_BOUNDS, { padding: [20, 20] });
  }, [map]);
  
  return null;
};