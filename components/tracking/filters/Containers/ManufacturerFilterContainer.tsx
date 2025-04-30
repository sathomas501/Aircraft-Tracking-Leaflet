import React from 'react';
import ManufacturerFilter from '../ManufacturerFilter';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import { useManufacturerFilter } from '../../hooks/useManufacturerFilter';

const ManufacturerFilterContainer: React.FC = () => {
  const { selectedRegion, activeDropdown, toggleDropdown, dropdownRefs } =
    useEnhancedMapContext();

  const {
    selectedManufacturer,
    manufacturerSearchTerm,
    setManufacturerSearchTerm,
    manufacturerOptions,
    selectManufacturerAndFilter,
    isLoading,
  } = useManufacturerFilter(
    typeof selectedRegion === 'number' ? selectedRegion : null
  );

  return (
    <ManufacturerFilter
      manufacturers={manufacturerOptions}
      selectedManufacturer={selectedManufacturer}
      manufacturerSearchTerm={manufacturerSearchTerm}
      setManufacturerSearchTerm={setManufacturerSearchTerm}
      selectManufacturerAndClose={selectManufacturerAndFilter}
      combinedLoading={isLoading}
      activeDropdown={activeDropdown}
      dropdownRef={dropdownRefs.manufacturer}
      toggleDropdown={toggleDropdown}
    />
  );
};

export default ManufacturerFilterContainer;
