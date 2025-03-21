// components/tracking/map/AircraftTrackingMap.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import { EnhancedMapProvider } from '../context/EnhancedMapContext';
import ContextUnifiedSelector from '../selector/ContextUnifiedSelector';
import type { SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

// Dynamically import the optimized map to avoid SSR issues
const EnhancedMap = dynamic(() => import('./EnhancedReactBaseMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface AircraftTrackingMapProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

/**
 * The main aircraft tracking map component.
 * This is the primary entry point for the aircraft tracking functionality.
 */
const AircraftTrackingMap: React.FC<AircraftTrackingMapProps> = ({
  manufacturers,
  onError,
}) => {
  return (
    <EnhancedMapProvider manufacturers={manufacturers} onError={onError}>
      <div className="relative w-full h-screen">
        {/* Map Component */}
        <EnhancedMap onError={onError} />

        {/* Unified Selector */}
        <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4 mt-4">
          <ContextUnifiedSelector manufacturers={manufacturers} />
        </div>
      </div>
    </EnhancedMapProvider>
  );
};

export default AircraftTrackingMap;
