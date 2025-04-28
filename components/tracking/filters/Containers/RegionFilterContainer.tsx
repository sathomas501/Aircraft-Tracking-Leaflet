// components/tracking/filters/Containers/RegionFilterContainer.tsx
import React, { useRef } from 'react';
import { useFilterContext } from '../../../tracking/context/FilterContext';
import { useRegionFilterAdapter } from '../../hooks/useFilterLogicAdapter';
import RegionFilter from '../RegionFilter';
import { FEATURE_FLAGS } from '../../../../config/featureFlags';

const RegionFilterContainer: React.FC = () => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use feature flag to determine which implementation to use
  const useNewImplementation = FEATURE_FLAGS.USE_CENTRALIZED_FILTERS.region;

  // Get props from either old or new implementation
  const oldProps = useFilterContext();
  const newProps = useRegionFilterAdapter();

  // Choose which implementation to use
  const props = useNewImplementation ? newProps : oldProps;

  return (
    <RegionFilter
      activeRegion={props.activeRegion}
      handleRegionSelect={props.handleRegionSelect}
      activeDropdown={props.activeDropdown}
      toggleDropdown={props.toggleDropdown}
      dropdownRef={dropdownRef}
      selectedRegion={props.selectedRegion}
      isGeofenceActive={props.isGeofenceActive}
    />
  );
};

export default RegionFilterContainer;
