// components/tracking/map/components/GeofenceCircle.tsx
import React from 'react';
import { Circle } from 'react-leaflet';
import { useFilterLogic } from '../../hooks/useFilterLogic'; // Updated import

const GeofenceCircle: React.FC = () => {
  const { geofenceCoordinates, geofenceRadius, isGeofenceActive } =
    useFilterLogic(); // Changed from useFilters

  if (!geofenceCoordinates || !isGeofenceActive) {
    return null;
  }

  const center: [number, number] = [
    geofenceCoordinates.lat,
    geofenceCoordinates.lng,
  ];
  const radiusInMeters = geofenceRadius * 1000; // Convert km to meters

  return (
    <Circle
      center={center}
      radius={radiusInMeters}
      pathOptions={{
        color: 'blue',
        fillColor: 'blue',
        fillOpacity: 0.2,
        weight: 2,
      }}
    />
  );
};

export default GeofenceCircle;
