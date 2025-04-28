// components/tracking/filters/Containers/OwnerFilterContainer.tsx
import React, { useRef } from 'react';
import { useCentralFilterState } from '../../context/CentralizedFilterContext';
import { useOwnerFilterLogic } from '../../hooks/useOwnerFilterLogic';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import OwnerFilter from '../OwnerFilter';

const OwnerFilterContainer: React.FC = () => {
  const { state, setActiveDropdown, setFilterMode } = useCentralFilterState();
  const mapContext = useEnhancedMapContext();

  const { ownerFilters, allOwnerTypes, handleOwnerFilterChange } =
    useOwnerFilterLogic({
      displayedAircraft: mapContext.displayedAircraft,
      updateGeofenceAircraft: mapContext.updateGeofenceAircraft,
      clearGeofenceData: mapContext.clearGeofenceData,
      activeDropdown: state.ui.activeDropdown,
      setActiveDropdown,
    });

  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <OwnerFilter
      activeFilters={ownerFilters}
      onFilterChange={handleOwnerFilterChange}
      allOwnerTypes={allOwnerTypes}
      activeDropdown={state.ui.activeDropdown}
      toggleFilterMode={(mode) => setFilterMode(mode)}
      dropdownRef={dropdownRef}
      toggleDropdown={(dropdown, event) => {
        const currentDropdown = state.ui.activeDropdown;
        setActiveDropdown(currentDropdown === dropdown ? null : dropdown);
        event.stopPropagation();
      }}
    />
  );
};

export default OwnerFilterContainer;
