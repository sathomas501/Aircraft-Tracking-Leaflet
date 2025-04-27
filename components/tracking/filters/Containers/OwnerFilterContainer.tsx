// components/acgiknrt / filters / Containers / OwnerFilterContainer.tsx;
import React, { useRef } from 'react';
import { useFilterContext } from '../../context/FilterContext';
import OwnerFilter from '../OwnerFilter';

const OwnerFilterContainer: React.FC = () => {
  const {
    ownerFilters,
    allOwnerTypes,
    handleOwnerFilterChange,
    activeDropdown,
    toggleDropdown,
    toggleFilterMode,
  } = useFilterContext();

  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <OwnerFilter
      activeFilters={ownerFilters || []}
      onFilterChange={handleOwnerFilterChange}
      allOwnerTypes={allOwnerTypes || []}
      activeDropdown={activeDropdown}
      toggleFilterMode={toggleFilterMode}
      dropdownRef={dropdownRef}
      toggleDropdown={toggleDropdown}
    />
  );
};

export default OwnerFilterContainer;
