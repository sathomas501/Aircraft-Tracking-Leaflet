// components/tracking/map/MapWithDataPersistence.tsx
import React from 'react';
import EnhancedReactBaseMap from './EnhancedReactBaseMap';
import DataPersistenceDebug from '../map/DataPersistenceDebug';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

interface MapWithDataPersistenceProps {
  onError?: (message: string) => void;
}

const MapWithDataPersistence: React.FC<MapWithDataPersistenceProps> = ({
  onError = () => {},
}) => {
  // Remove the reference to debugMode since it doesn't exist in your context
  // Option 1: Use a flag from environment or props instead
  const showDebug = process.env.NODE_ENV === 'development';

  // Or if you want to keep using context, add debugMode to your EnhancedMapContext first
  // Option 2 (requires updating your context type)
  // const { debugMode } = useEnhancedMapContext();

  return (
    <div className="relative w-full h-full">
      <EnhancedReactBaseMap onError={onError} />
      {/* Data Persistence Debug Panel (only shown in debug mode) */}
      {showDebug && <DataPersistenceDebug />}
    </div>
  );
};

export default MapWithDataPersistence;
