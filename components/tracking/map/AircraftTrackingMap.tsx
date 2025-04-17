// components/tracking/map/AircraftTrackingMap.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import { EnhancedMapProvider } from '../context/EnhancedMapContext';
import { EnhancedUIProvider } from '../../tracking/context/EnhancedUIContext';
import type { SelectOption } from '@/types/base';
import AircraftSpinner from '../../tracking/map/components/AircraftSpinner';
import RibbonAircraftSelector from '../selector/Ribbon'; // Adjust this path to where your Ribbon.tsx file is located

// Dynamically import the optimized map to avoid SSR issues
const EnhancedMap = dynamic(() => import('./EnhancedReactBaseMap'), {
  ssr: false,
  loading: () => <AircraftSpinner isLoading={true} />,
});

interface AircraftTrackingMapProps {
  manufacturers: SelectOption[];
  onError?: (message: string) => void;
}

const AircraftTrackingMap: React.FC<AircraftTrackingMapProps> = ({
  manufacturers,
  onError = () => {},
}) => {
  return (
    // Nest providers - UI context wraps Map context
    <EnhancedUIProvider>
      <EnhancedMapProvider manufacturers={manufacturers} onError={onError}>
        <div className="relative w-full h-screen">
          <RibbonAircraftSelector manufacturers={manufacturers} />
          {/* Map Component */}
          <EnhancedMap onError={onError} />

          {/* UI Components - Now controlled by our unified UI system */}
        </div>
      </EnhancedMapProvider>
    </EnhancedUIProvider>
  );
};

export default AircraftTrackingMap;
