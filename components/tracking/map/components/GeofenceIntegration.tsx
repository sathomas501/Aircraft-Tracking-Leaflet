import React, { useEffect, useState } from 'react';
import { useMapEvents, Circle, Marker } from 'react-leaflet';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import L from 'leaflet';

interface GeofenceMapIntegrationProps {
  isGeofenceActive: boolean;
  geofenceCoordinates: { lat: number; lng: number } | null;
  geofenceRadius: number;
}

const GeofenceMapIntegration: React.FC<GeofenceMapIntegrationProps> = ({
  isGeofenceActive,
  geofenceCoordinates,
  geofenceRadius,
}) => {
  const { isGeofencePlacementMode, setIsGeofencePlacementMode } =
    useEnhancedMapContext();
  const [showIndicator, setShowIndicator] = useState(false);
  const [previewCoordinates, setPreviewCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Standard marker icon (you can replace with your own)
  const geofenceIcon = new L.Icon({
    iconUrl: '/images/marker-icon.png', // Default Leaflet marker or your custom icon
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: '/images/marker-shadow.png',
    shadowSize: [41, 41],
  });

  // Listen for geofence placement mode changes
  useEffect(() => {
    const handlePlacementModeChange = (e: CustomEvent) => {
      const { active } = e.detail;
      setIsGeofencePlacementMode(active);
    };

    document.addEventListener(
      'enable-geofence-placement',
      handlePlacementModeChange as EventListener
    );

    return () => {
      document.removeEventListener(
        'enable-geofence-placement',
        handlePlacementModeChange as EventListener
      );
    };
  }, [setIsGeofencePlacementMode]);

  // Show indicator when in placement mode
  useEffect(() => {
    if (isGeofencePlacementMode) {
      setShowIndicator(true);
      // Change cursor to crosshair
      document.body.style.cursor = 'crosshair';
    } else {
      setShowIndicator(false);
      // Reset cursor
      document.body.style.cursor = '';
    }

    return () => {
      // Ensure cursor is reset when component unmounts
      document.body.style.cursor = '';
    };
  }, [isGeofencePlacementMode]);

  // Need to debounce map click events to prevent multiple rapid clicks
  const [lastClickTime, setLastClickTime] = useState(0);

  // Map event handler for clicks with debouncing and improved prevention
  const map = useMapEvents({
    click: (e) => {
      const now = Date.now();
      // Only process clicks that are at least 1 second apart
      if (isGeofencePlacementMode && now - lastClickTime > 1000) {
        const { lat, lng } = e.latlng;

        // Update last click time
        setLastClickTime(now);

        // Immediately show a preview of the geofence on the map
        setPreviewCoordinates({ lat, lng });

        // Dispatch custom event for the floating panel
        const event = new CustomEvent('map-geofence-click', {
          detail: { lat, lng },
        });
        document.dispatchEvent(event);

        // Log the click for debugging
        console.log('Geofence placement click at:', lat, lng);

        // More aggressive event prevention
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
          e.originalEvent.stopImmediatePropagation(); // Add this to prevent all other handlers

          // Cancel any pending click events
          if (e.originalEvent.cancelable) {
            e.originalEvent.cancelBubble = true;
          }
        }

        // Return false to prevent default behavior
        return false;
      }
    },
  });

  return (
    <>
      {/* Show the geofence circle on the map when active */}
      {isGeofenceActive && geofenceCoordinates && (
        <>
          <Circle
            center={[geofenceCoordinates.lat, geofenceCoordinates.lng]}
            radius={geofenceRadius * 1000} // Convert km to meters
            pathOptions={{
              color: '#4f46e5', // Indigo color
              fillColor: '#4f46e5',
              fillOpacity: 0.1,
              weight: 2,
            }}
          />
          <Marker
            position={[geofenceCoordinates.lat, geofenceCoordinates.lng]}
            icon={geofenceIcon}
          />
        </>
      )}

      {/* Show preview marker and circle when in placement mode and a location is clicked */}
      {isGeofencePlacementMode && previewCoordinates && (
        <>
          <Circle
            center={[previewCoordinates.lat, previewCoordinates.lng]}
            radius={geofenceRadius * 1000} // Convert km to meters
            pathOptions={{
              color: '#10b981', // Green color for preview
              fillColor: '#10b981',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 5', // Dashed line for preview
            }}
          />
          <Marker
            position={[previewCoordinates.lat, previewCoordinates.lng]}
            icon={geofenceIcon}
          />
        </>
      )}

      {/* Show the click indicator when in placement mode */}
      {showIndicator && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg z-30 pointer-events-none">
          Click anywhere on map to set geofence location
        </div>
      )}
    </>
  );
};

export default GeofenceMapIntegration;
