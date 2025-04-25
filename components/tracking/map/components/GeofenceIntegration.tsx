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

  const geofenceIcon = new L.Icon({
    iconUrl: '/images/marker-icon.png', // Check this path
    iconSize: [25, 41],
    iconAnchor: [12, 41], // Make sure to add this line
    popupAnchor: [1, -34],
    shadowUrl: '/images/marker-shadow.png',
    shadowSize: [41, 41],
    // Make sure to add a proper tooltip for accessibility
    tooltipAnchor: [16, -28],
  });

  // In your GeofenceMapIntegration component
  useEffect(() => {
    // More selective approach to capture only specific clicks
    const captureFilterClicks = (e: MouseEvent) => {
      if (isGeofencePlacementMode) {
        // Don't interfere with map container clicks at all
        if (
          e.target instanceof Element &&
          e.target.closest('.leaflet-container')
        ) {
          // Do nothing - let the map click handler work normally
          return;
        }

        // Don't interfere with the panel itself
        if (
          e.target instanceof Element &&
          e.target.closest('.geofence-floating-panel')
        ) {
          // Do nothing - let panel clicks work normally
          return;
        }

        // Only for clicks outside map and panel, prevent default behavior
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // Add listener in the capturing phase (true is important)
    document.addEventListener('click', captureFilterClicks, true);

    return () => {
      document.removeEventListener('click', captureFilterClicks, true);
    };
  }, [isGeofencePlacementMode]);

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

  // Setup event capturing for all map elements
  useEffect(() => {
    // Function to capture and stop all click events when in placement mode
    const captureClicks = (e: MouseEvent) => {
      if (isGeofencePlacementMode) {
        // Don't interfere with clicks on the panel itself
        const panelElement = document.querySelector('.geofence-floating-panel');
        if (panelElement && panelElement.contains(e.target as Node)) {
          return;
        }

        // Don't interfere with clicks on the map itself - these should be handled by the map click handler
        const mapElement = document.querySelector('.leaflet-container');
        if (mapElement && mapElement.contains(e.target as Node)) {
          return;
        }

        // Only prevent clicks on non-map, non-panel elements
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    // Add capturing event listener to catch events before they reach other handlers
    document.addEventListener('click', captureClicks, true);

    return () => {
      document.removeEventListener('click', captureClicks, true);
    };
  }, [isGeofencePlacementMode]);

  const map = useMapEvents({
    click: (e) => {
      if (isGeofencePlacementMode) {
        const { lat, lng } = e.latlng;

        // Dispatch a custom event with the coordinates
        const event = new CustomEvent('map-geofence-click', {
          detail: { lat, lng },
        });
        document.dispatchEvent(event);
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
