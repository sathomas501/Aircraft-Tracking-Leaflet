// components/tracking/filters/Containers/RegionFilterContainer.tsx
import React, { useRef } from 'react';
import { useFilterLogic } from '../../hooks/useFilterLogicCompatible';
import RegionFilter from '../RegionFilter';
import { RegionCode } from '../../../../types/base';

const RegionFilterContainer: React.FC = () => {
  const {
    activeRegion,
    handleRegionSelect,
    activeDropdown,
    toggleDropdown,
    isGeofenceActive,
  } = useFilterLogic();

  // Create a ref for the dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the selected region from activeRegion or provide a default
  // This assumes activeRegion is the same as selectedRegion in your current model
  const selectedRegion = Number(activeRegion) || RegionCode.GLOBAL;

  return (
    <RegionFilter
      activeRegion={activeRegion}
      handleRegionSelect={handleRegionSelect}
      activeDropdown={activeDropdown}
      toggleDropdown={toggleDropdown}
      dropdownRef={dropdownRef}
      selectedRegion={selectedRegion}
      isGeofenceActive={isGeofenceActive}
      // Add the missing properties that TypeScript is complaining about
      geofence={{ active: false }} // Fill with appropriate default values
      manufacturer={{ value: null, active: false }} // Fill with appropriate default values
      region={{ value: null, active: false }} // Fill with appropriate default values
    />
  );
};

export default RegionFilterContainer;
