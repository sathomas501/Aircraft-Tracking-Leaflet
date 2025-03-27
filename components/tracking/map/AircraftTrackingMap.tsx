// components/tracking/map/AircraftTrackingMap.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import { EnhancedMapProvider } from '../context/EnhancedMapContext';
import { EnhancedUIProvider } from '../../tracking/context/EnhancedUIContext';
import EnhancedUnifiedSelector from '../selector/EnhancedUnifiedSelector';
import type { SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import UnifiedAircraftInfoPanel from '../map/components/UnifiedAircraftInfoPanel';

// Dynamically import the optimized map to avoid SSR issues
const EnhancedMap = dynamic(() => import('./EnhancedReactBaseMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
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
          {/* Map Component */}
          <EnhancedMap onError={onError} />

          {/* UI Components - Now controlled by our unified UI system */}
          <UnifiedAircraftInfoPanel />
        </div>
      </EnhancedMapProvider>
    </EnhancedUIProvider>
  );
};

export default AircraftTrackingMap;
