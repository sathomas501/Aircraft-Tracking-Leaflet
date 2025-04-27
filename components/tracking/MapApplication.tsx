// components/tracking/MapApplication.tsx
import React from 'react';
import { FilterProvider } from '../tracking/context/FilterContext';
import { EnhancedMapProvider } from './context/EnhancedMapContext';
import { EnhancedUIProvider } from './context/EnhancedUIContext';
import Ribbon from '../tracking/Ribbon'; // Updated import
import EnhancedReactBaseMap from './map/EnhancedReactBaseMap';

const MapApplication: React.FC = () => {
  const handleError = (message: string) => {
    console.error(message);
    // Handle error, show toast, etc.
  };

  return (
    <EnhancedMapProvider>
      <EnhancedUIProvider>
        <FilterProvider>
          <div className="h-screen flex flex-col">
            {/* Replaced FilterBar with Ribbon */}
            <Ribbon />
            <div className="flex-1">
              <EnhancedReactBaseMap onError={handleError} />
            </div>
          </div>
        </FilterProvider>
      </EnhancedUIProvider>
    </EnhancedMapProvider>
  );
};

export default MapApplication;
