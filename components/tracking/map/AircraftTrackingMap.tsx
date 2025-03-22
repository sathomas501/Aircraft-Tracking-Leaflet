// components/tracking/map/AircraftTrackingMap.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import { EnhancedMapProvider } from '../context/EnhancedMapContext';
import EnhancedUnifiedSelector from '../selector/EnhancedUnifiedSelector'; // Keep the same import name
import type { SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

// Dynamically import the optimized map to avoid SSR issues
const EnhancedMap = dynamic(() => import('./EnhancedReactBaseMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface AircraftTrackingMapProps {
  manufacturers: SelectOption[];
  onError?: (message: string) => void; // Make onError optional
}

const AircraftTrackingMap: React.FC<AircraftTrackingMapProps> = ({
  manufacturers,
  onError = () => {}, // Provide default implementation
}) => {
  return (
    <EnhancedMapProvider manufacturers={manufacturers} onError={onError}>
      <div className="relative w-full h-screen">
        {/* Map Component */}
        <EnhancedMap onError={onError} />

        {/* Aircraft Selector */}
        <EnhancedUnifiedSelector manufacturers={manufacturers} />
      </div>
    </EnhancedMapProvider>
  );
};

export default AircraftTrackingMap;
