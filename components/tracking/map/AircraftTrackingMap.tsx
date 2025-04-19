// components/tracking/map/AircraftTrackingMap.tsx
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { EnhancedMapProvider } from '../context/EnhancedMapContext';
import { EnhancedUIProvider } from '../../tracking/context/EnhancedUIContext';
import type { SelectOption } from '@/types/base';
import AircraftSpinner from '../../tracking/map/components/AircraftSpinner';
import RibbonAircraftSelector from '../selector/Ribbon';

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
  // Add state for controlling update panel visibility
  const [updatePanelVisible, setUpdatePanelVisible] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  // Show the update panel after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setUpdatePanelVisible(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle update completion
  const handleUpdateComplete = () => {
    setUpdateCount((prev) => prev + 1);
  };

  // Toggle update panel visibility
  const toggleUpdatePanel = () => {
    setUpdatePanelVisible(!updatePanelVisible);
  };

  return (
    // Nest providers - UI context wraps Map context
    <EnhancedUIProvider>
      <EnhancedMapProvider manufacturers={manufacturers} onError={onError}>
        <div className="relative w-full h-screen flex flex-col">
          {/* Sticky Ribbon */}
          <RibbonAircraftSelector manufacturers={manufacturers} />

          {/* Fill the rest of the space with the map */}
          <div className="flex-grow relative z-0">
            <EnhancedMap onError={onError} />
          </div>
        </div>
      </EnhancedMapProvider>
    </EnhancedUIProvider>
  );
};

export default AircraftTrackingMap;
