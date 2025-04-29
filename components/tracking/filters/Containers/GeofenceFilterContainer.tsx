// components/tracking/filters/Containers/GeofenceFilterContainer.tsx
import React from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import GeofenceFilterComponent from '../GeofenceFilterComponent';

interface GeofenceFilterContainerProps {
  onClose?: () => void;
  dropdownRef?: React.RefObject<HTMLDivElement>; // Add support for the dropdown ref
}

const GeofenceFilterContainer: React.FC<GeofenceFilterContainerProps> = ({
  onClose,
  dropdownRef,
}) => {
  // Get all required state and methods directly from the EnhancedMapContext
  const {
    isGeofenceActive,
    geofenceCenter,
    geofenceRadius,
    trackingStatus,
    isLoading,
    onLocationChange,
    onRadiusChange,
    onSearch,
    onGetLocation,
    onToggleChange,
  } = useEnhancedMapContext();

  // Derived state
  const geofenceLocation = geofenceCenter
    ? `${geofenceCenter.lat.toFixed(6)}, ${geofenceCenter.lng.toFixed(6)}`
    : '';
  const hasError = trackingStatus.includes('Error') ? trackingStatus : null;
  const isGettingLocation = isLoading;

  // Create wrapped handlers that close the dropdown when appropriate
  const handleSearch = () => {
    onSearch();
    if (onClose) onClose();
  };

  const handleGetLocation = () => {
    onGetLocation();
    if (onClose) onClose();
  };

  return (
    <div ref={dropdownRef}>
      <GeofenceFilterComponent
        isGeofenceActive={isGeofenceActive}
        geofenceLocation={geofenceLocation}
        geofenceRadius={geofenceRadius || 25}
        geofenceCoordinates={geofenceCenter}
        isGettingLocation={isGettingLocation}
        hasError={hasError}
        onLocationChange={onLocationChange}
        onRadiusChange={onRadiusChange}
        onSearch={handleSearch}
        onGetLocation={handleGetLocation}
        onToggleChange={onToggleChange}
      />
    </div>
  );
};

export default GeofenceFilterContainer;
