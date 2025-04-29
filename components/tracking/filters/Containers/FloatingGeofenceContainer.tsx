// components/tracking/filters/Containers/FloatingGeofencePanelContainer.tsx
import React, { useState, useEffect } from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import FloatingGeofencePanelComponent from '../FloatingGeofencePanel';
import { MapboxService } from '../../../../lib/services/MapboxService';

// Define panel position interface
interface PanelPosition {
  x: number;
  y: number;
}

const FloatingGeofencePanelContainer: React.FC = () => {
  // Get required state from EnhancedMapContext
  const {
    isGeofenceActive,
    geofenceCenter,
    geofenceRadius,
    setGeofenceCenter,
    setGeofenceRadius,
    toggleGeofence,
    clearGeofence,
    isLoading,
    trackingStatus,
    isGeofencePlacementMode,
    setIsGeofencePlacementMode,
  } = useEnhancedMapContext();

  // Local state for panel management
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null
  );
  const [tempCoordinates, setTempCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);

  // Derived state
  const hasError = trackingStatus.includes('Error') ? trackingStatus : null;
  const isSearching = isLoading;

  // Effect to update temp coordinates when geofenceCenter changes
  useEffect(() => {
    if (
      geofenceCenter &&
      (!tempCoordinates ||
        tempCoordinates.lat !== geofenceCenter.lat ||
        tempCoordinates.lng !== geofenceCenter.lng)
    ) {
      setTempCoordinates(geofenceCenter);

      // Get location name for these coordinates
      fetchLocationName(geofenceCenter.lat, geofenceCenter.lng);
    }
  }, [geofenceCenter, tempCoordinates]);

  // Handler for map click events - open panel at that location
  useEffect(() => {
    const handleMapGeofenceClick = async (event: Event) => {
      try {
        // Cast the event to the proper type
        const customEvent = event as CustomEvent<{ lat: number; lng: number }>;
        const { lat, lng } = customEvent.detail;

        // Only respond to clicks if we're in placement mode or the panel is already open
        if (!isGeofencePlacementMode && !showPanel) return;

        // Calculate panel position (offset from click)
        const screenX = window.event
          ? (window.event as any).clientX
          : window.innerWidth / 2;
        const screenY = window.event
          ? (window.event as any).clientY
          : window.innerHeight / 2;

        // Position panel near click but ensure it stays within viewport
        const panelX = Math.min(screenX, window.innerWidth - 320);
        const panelY = Math.min(screenY, window.innerHeight - 220);

        // Update temp coordinates
        setTempCoordinates({ lat, lng });

        // Update panel position and show panel
        setPanelPosition({ x: panelX, y: panelY });
        setShowPanel(true);

        // Exit placement mode
        setIsGeofencePlacementMode(false);

        // Get location name for these coordinates
        fetchLocationName(lat, lng);
      } catch (error) {
        console.error('Error handling map click:', error);
      }
    };

    // Listen for custom map-geofence-click events
    document.addEventListener(
      'map-geofence-click',
      handleMapGeofenceClick as EventListener
    );

    return () => {
      document.removeEventListener(
        'map-geofence-click',
        handleMapGeofenceClick as EventListener
      );
    };
  }, [isGeofencePlacementMode, showPanel, setIsGeofencePlacementMode]);

  // Function to fetch location name from coordinates
  const fetchLocationName = async (lat: number, lng: number) => {
    setIsLoadingLocation(true);
    try {
      const name = await MapboxService.getLocationNameFromCoordinates(lat, lng);
      setLocationName(name);
    } catch (error) {
      console.error('Error getting location name:', error);
      // Use fallback of coordinate string
      setLocationName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Handle panel close
  const handleClose = () => {
    setShowPanel(false);
    setPanelPosition(null);
  };

  // Handle panel reset
  const handleReset = () => {
    setShowPanel(false);
    setPanelPosition(null);
    setTempCoordinates(null);
    setLocationName(null);
    clearGeofence();
  };

  // Handle radius change
  const handleRadiusChange = (radius: number) => {
    setGeofenceRadius(radius);
  };

  // Handle search from panel
  const handleSearch = (lat: number, lng: number) => {
    // Update final coordinates and activate geofence
    setGeofenceCenter({ lat, lng });
    if (!isGeofenceActive) {
      toggleGeofence();
    }

    // Close panel after search
    setShowPanel(false);
  };

  // Handle panel position update
  const handlePositionUpdate = (position: PanelPosition) => {
    setPanelPosition(position);
  };

  // Only render if panel should be shown
  if (!showPanel || !panelPosition || !tempCoordinates) {
    return null;
  }

  return (
    <FloatingGeofencePanelComponent
      isOpen={showPanel}
      panelPosition={panelPosition}
      geofenceRadius={geofenceRadius || 25} // Default to 25 if null
      isGeofenceActive={isGeofenceActive}
      tempCoordinates={tempCoordinates}
      locationName={locationName}
      isLoadingLocation={isLoadingLocation}
      isSearching={isSearching}
      hasError={hasError}
      onClose={handleClose}
      onReset={handleReset}
      onRadiusChange={handleRadiusChange}
      onSearch={handleSearch}
      onPositionUpdate={handlePositionUpdate}
    />
  );
};

export default FloatingGeofencePanelContainer;
