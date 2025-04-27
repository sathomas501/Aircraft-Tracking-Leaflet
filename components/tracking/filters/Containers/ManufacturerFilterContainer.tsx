import React, { useRef } from 'react';
import { useFilterContext } from '../../context/FilterContext';
import ManufacturerFilter from '../ManufacturerFilter';

const ManufacturerFilterContainer: React.FC = () => {
  const {
    selectedManufacturer,
    setSelectedManufacturer,
    activeDropdown,
    toggleDropdown,
    manufacturers,
    combinedLoading,
    manufacturerSearchTerm,
    setManufacturerSearchTerm,
    activeRegion,
    totalActive,
    regionCounts,
    handleManufacturerSelect,
  } = useFilterContext();

  const dropdownRef = useRef<HTMLDivElement>(null);

  console.log('Raw manufacturers:', manufacturers);

  const transformedManufacturers =
    manufacturers?.map((m) => ({
      value: m.name,
      label: m.name,
      manufacturer: m.name,
      count: m.count || 0,
    })) || [];

  const handleError = (message: string) => {
    console.error(`[ManufacturerFilter] Error: ${message}`);
  };
  console.log('Manufacturers from context:', manufacturers);

  return (
    <ManufacturerFilter
      selectedManufacturer={selectedManufacturer}
      handleManufacturerSelect={handleManufacturerSelect}
      activeDropdown={activeDropdown}
      toggleDropdown={toggleDropdown}
      dropdownRef={dropdownRef}
      manufacturers={transformedManufacturers}
      combinedLoading={combinedLoading || false}
      manufacturerSearchTerm={manufacturerSearchTerm || ''}
      setManufacturerSearchTerm={setManufacturerSearchTerm}
      activeRegion={activeRegion}
      totalActive={totalActive}
      regionCounts={{
        totalActive: regionCounts?.totalActive || 0,
        manufacturerCount: regionCounts?.manufacturerCount || 0,
        modelCount: regionCounts?.modelCount || 0,
        selectedManufacturerCount: regionCounts?.selectedManufacturerCount || 0,
        selectedModelCount: regionCounts?.selectedModelCount || 0,
      }}
      searchTerm={manufacturerSearchTerm || ''}
      setSearchTerm={setManufacturerSearchTerm}
      onError={handleError}
    />
  );
};

export default ManufacturerFilterContainer;
