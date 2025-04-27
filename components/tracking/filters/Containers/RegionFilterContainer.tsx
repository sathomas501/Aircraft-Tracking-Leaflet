// components/tracking/filters/Containers/RegionFilterContainer.tsx
import React, { useRef } from 'react';
import { useFilterContext } from '../../context/FilterContext';
import RegionFilter from '../RegionFilter';
import { RegionCode } from '../../../../types/base'; // adjust path if needed

const RegionFilterContainer: React.FC = () => {
  const {
    activeRegion,
    selectedRegion,
    handleRegionSelect,
    activeDropdown,
    toggleDropdown,
    isGeofenceActive,
  } = useFilterContext();

  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <RegionFilter
      activeRegion={activeRegion}
      handleRegionSelect={handleRegionSelect}
      activeDropdown={activeDropdown}
      toggleDropdown={toggleDropdown}
      dropdownRef={dropdownRef}
      selectedRegion={selectedRegion}
      isGeofenceActive={isGeofenceActive}
    />
  );
};

export default RegionFilterContainer;
