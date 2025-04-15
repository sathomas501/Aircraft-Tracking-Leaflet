// components/tracking/map/GeofenceControl.tsx
import React, { useEffect } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

interface GeofenceControlProps {
  onTabChange?: (tabName: string) => void; // Optional prop to switch tabs
}

export const GeofenceControl: React.FC<GeofenceControlProps> = ({
  onTabChange,
}) => {
  const {
    isGeofenceActive,
    toggleGeofence,
    clearGeofence,
    geofenceCoordinates,
  } = useEnhancedMapContext();

  // When geofence is activated from this button, switch to the location tab
  const handleToggleGeofence = () => {
    // If enabling geofence, switch to location tab
    if (!isGeofenceActive && onTabChange) {
      onTabChange('geofence');
    }
    toggleGeofence();
  };

  return (
    <div className="bg-white p-2 rounded-md shadow-md">
      <button
        onClick={handleToggleGeofence}
        className={`px-3 py-1 rounded-md ${
          isGeofenceActive ? 'bg-blue-500 text-white' : 'bg-gray-200'
        }`}
      >
        {isGeofenceActive ? 'Geofence Active' : 'Enable Geofence'}
      </button>

      {isGeofenceActive && (
        <button
          onClick={() => {
            clearGeofence();
            // Optionally switch back to default tab
            if (onTabChange) onTabChange('manufacturer');
          }}
          className="px-3 py-1 rounded-md bg-red-100 text-red-700 ml-2"
        >
          Clear
        </button>
      )}

      {isGeofenceActive && !geofenceCoordinates && (
        <p className="text-sm mt-1">
          Click on the map to set geofence location
        </p>
      )}
    </div>
  );
};

export default GeofenceControl;
