// components/tracking/map/AircraftTrackingMap.tsx
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { EnhancedMapProvider } from '../context/EnhancedMapContext';
import { EnhancedUIProvider } from '../../tracking/context/EnhancedUIContext';
import EnhancedReactBaseMap from './EnhancedReactBaseMap';
import { FilterProvider } from '../context/FilterContext'; // Add this import
import type { SelectOption } from '../../../types/base';
import AircraftSpinner from '../../tracking/map/components/AircraftSpinner';
import RibbonAircraftSelector from './RibbonAircraftSelector';
import Ribbon from '../Ribbon';

// Dynamically import the optimized map to avoid SSR issues
const EnhancedMap = dynamic(() => import('./EnhancedReactBaseMap'), {
  ssr: false,
  loading: () => <AircraftSpinner isLoading={true} />,
});

interface AircraftTrackingMapProps {
  manufacturers?: any[]; // Make it optional
  onError: (message: string) => void;
}

const AircraftTrackingMap: React.FC<AircraftTrackingMapProps> = ({
  manufacturers,
  onError = () => {},
}) => {
  // Add state for controlling update panel visibility
  const [updatePanelVisible, setUpdatePanelVisible] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const handleError = (message: string) => {
    console.error(message);
    // Handle error, show toast, etc.
  };

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
    // Nest providers - UI context wraps Map context, which wraps Filter context
    <EnhancedUIProvider>
      <EnhancedMapProvider manufacturers={manufacturers} onError={onError}>
        <FilterProvider>
          <div className="h-screen flex flex-col">
            {/* Replaced FilterBar with Ribbon */}
            <Ribbon />
            <div className="flex-1">
              <EnhancedReactBaseMap onError={handleError} />
            </div>
          </div>
        </FilterProvider>
      </EnhancedMapProvider>
    </EnhancedUIProvider>
  );
};

export default AircraftTrackingMap;
