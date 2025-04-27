// components/tracking/filters/Containers/GeofenceFilterContainer.tsx
import React, { useRef } from 'react';
import { useFilterContext } from '../../context/FilterContext';
import GeofenceFilter from '../GeofenceFilter';

const GeofenceFilterContainer: React.FC = () => {
  const {
    geofenceLocation,
    setGeofenceLocation,
    geofenceRadius,
    setGeofenceRadius,
    isGettingLocation,
    setIsGettingLocation,
    isGeofenceActive,
    toggleGeofenceState,
    geofenceCoordinates,
    setGeofenceCoordinates,
    activeDropdown,
    setActiveDropdown,
    toggleDropdown,
    combinedLoading,
    processGeofenceSearch,
    getUserLocation,
    isGeofencePlacementMode,
    setGeofenceCenter,
    updateGeofenceAircraft,
  } = useFilterContext();

  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <GeofenceFilter
      geofenceLocation={geofenceLocation || ''}
      geofenceRadius={geofenceRadius || 50}
      isGettingLocation={isGettingLocation}
      isGeofenceActive={isGeofenceActive}
      geofenceCoordinates={geofenceCoordinates}
      getUserLocation={getUserLocation}
      processGeofenceSearch={processGeofenceSearch}
      toggleGeofenceState={toggleGeofenceState}
      setGeofenceLocation={setGeofenceLocation}
      setGeofenceRadius={setGeofenceRadius}
      setGeofenceCoordinates={setGeofenceCoordinates}
      setGeofenceCenter={setGeofenceCenter}
      updateGeofenceAircraft={() => updateGeofenceAircraft([])}
      combinedLoading={combinedLoading}
      activeDropdown={activeDropdown}
      setActiveDropdown={setActiveDropdown}
      toggleDropdown={toggleDropdown}
      dropdownRef={dropdownRef}
      isGeofencePlacementMode={isGeofencePlacementMode}
      setIsGettingLocation={setIsGettingLocation}
    />
  );
};

export default GeofenceFilterContainer;
