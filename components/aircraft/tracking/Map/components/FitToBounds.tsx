// components/aircraft/tracking/Map/LeafletMap/components/FitToBounds.tsx
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { CONTINENTAL_US_BOUNDS } from '../../../../../config/map';

interface FitToBoundsProps {
  trigger?: boolean; // ✅ Optional trigger to control behavior
}

export const FitToBounds: React.FC<FitToBoundsProps> = ({ trigger = false }) => {
  const map = useMap();
  
  useEffect(() => {
    if (trigger && CONTINENTAL_US_BOUNDS) {
      console.log('Applying fitBounds:', CONTINENTAL_US_BOUNDS);  // Debugging line
      map.fitBounds(CONTINENTAL_US_BOUNDS, { padding: [20, 20] });
    }
  }, [trigger, map]);
  
  
  return null;
};
