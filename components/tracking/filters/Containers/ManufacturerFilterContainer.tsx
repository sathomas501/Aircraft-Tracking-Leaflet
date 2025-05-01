// components/tracking/filters/Containers/ManufacturerFilterContainer.tsx
import React from 'react';
import ManufacturerFilter from '../ManufacturerFilter';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import { useManufacturerFilter } from '../../hooks/useManufacturerFilter';

const ManufacturerFilterContainer: React.FC = () => {
  const { selectedRegion, activeDropdown, toggleDropdown, dropdownRefs } =
    useEnhancedMapContext();

  // Always call the hook, even with null fallback
  const manufacturerFilter =
    useManufacturerFilter(
      typeof selectedRegion === 'number' ? selectedRegion : null
    ) ?? {};

  // Safely destructure with fallbacks to avoid TS2339
  const {
    selectedManufacturer = null,
    manufacturerSearchTerm = '',
    setManufacturerSearchTerm = () => {},
    manufacturerOptions = [],
    selectManufacturerAndFilter = () => {},
    isLoading = false,
    fetchModelsForManufacturer = () => {},
    applyAllFilters = () => {},
  } = manufacturerFilter;

  return (
    <ManufacturerFilter
      selectedManufacturer={selectedManufacturer}
      manufacturerSearchTerm={manufacturerSearchTerm}
      setManufacturerSearchTerm={setManufacturerSearchTerm}
      manufacturers={manufacturerOptions}
      selectManufacturerAndClose={selectManufacturerAndFilter}
      combinedLoading={isLoading}
      activeDropdown={activeDropdown}
      dropdownRef={dropdownRefs?.manufacturer}
      toggleDropdown={toggleDropdown}
      fetchModelsForManufacturer={fetchModelsForManufacturer}
      applyAllFilters={applyAllFilters}
    />
  );
};

export default ManufacturerFilterContainer;
