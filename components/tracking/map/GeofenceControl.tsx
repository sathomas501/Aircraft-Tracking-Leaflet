// components/tracking/map/GeofenceControl.tsx
import React from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

export const GeofenceControl: React.FC = () => {
  const { isGeofenceActive, toggleGeofence, clearGeofence } = useEnhancedMapContext();
  
  return (
    <div className="bg-white p-2 rounded-md shadow-md">
      <button
        onClick={toggleGeofence}
        className={`px-3 py-1 rounded-md ${
          isGeofenceActive ? 'bg-blue-500 text-white' : 'bg-gray-200'
        }`}
      >
        {isGeofenceActive ? 'Geofence Active' : 'Enable Geofence'}
      </button>
      
      {isGeofenceActive && (
        <button
          onClick={clearGeofence}
          className="px-3 py-1 rounded-md bg-red-100 text-red-700 ml-2"
        >
          Clear
        </button>
      )}
      
      {isGeofenceActive && (
        <p className="text-sm mt-1">
          Click on the map to set geofence location
        </p>
      )}
    </div>
  );
};

export default GeofenceControl;