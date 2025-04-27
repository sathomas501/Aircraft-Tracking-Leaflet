// components/tracking/map/components/MapClickHandler.tsx
import React from 'react';
import { useMapEvents } from 'react-leaflet';
import { useFilterLogic } from '../../hooks/useFilterLogic'; // Updated import

const MapClickHandler: React.FC = () => {
  const {
    isGeofencePlacementMode,
    // setIsGeofencePlacementMode, // Removed as it does not exist in FilterLogicReturnType
    setGeofenceCoordinates,
  } = useFilterLogic();

  // Map event handler
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;

      // Only process as geofence click if in placement mode
      if (isGeofencePlacementMode) {
        console.log('Map clicked for geofence at:', lat, lng);

        // Set the geofence coordinates
        setGeofenceCoordinates({ lat, lng });

        // Dispatch custom event for any other components that need to know
        const event = new CustomEvent('map-geofence-click', {
          detail: { lat, lng },
        });
        document.dispatchEvent(event);

        // Exit placement mode after setting location
        // setIsGeofencePlacementMode(false); // Removed as it is not defined
      }
    },
  });

  return null;
};

export default MapClickHandler;
