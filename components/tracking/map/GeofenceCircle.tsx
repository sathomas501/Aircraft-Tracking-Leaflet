// components/tracking/map/GeofenceCircle.tsx
import React from 'react';
import { Circle, Popup } from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

export const GeofenceCircle: React.FC = () => {
  const { 
    geofenceCenter, 
    geofenceRadius, 
    isGeofenceActive, 
    clearGeofence, 
    setGeofenceRadius 
  } = useEnhancedMapContext();
  
  if (!geofenceCenter || !isGeofenceActive) return null;
  
  return (
    <Circle
      center={[geofenceCenter.lat, geofenceCenter.lng]}
      radius={(geofenceRadius ?? 0) * 1000} // Convert km to meters
      pathOptions={{
        color: 'blue',
        fillColor: 'blue',
        fillOpacity: 0.1,
      }}
    >
      <Popup>
        <div>
          <p>Geofence Radius: {geofenceRadius} km</p>
          <input
            type="range"
            min="1"
            max="50"
            value={geofenceRadius ?? 0}
            onChange={(e) => setGeofenceRadius(Number(e.target.value))}
          />
          <button onClick={clearGeofence}>Clear Geofence</button>
        </div>
      </Popup>
    </Circle>
  );
};

export default GeofenceCircle;