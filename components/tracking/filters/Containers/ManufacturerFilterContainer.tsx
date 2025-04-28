// components/tracking/filters/Containers/ManufacturerFilterContainer.tsx
import React, { useRef, useEffect } from 'react';
import { useFilterContext } from '../../context/FilterContext';
import ManufacturerFilter from '../ManufacturerFilter';

const ManufacturerFilterContainer: React.FC = () => {
  const {
    selectedManufacturer,
    handleManufacturerSelect,
    manufacturers,
    activeDropdown,
    toggleDropdown,
    manufacturerSearchTerm,
    setManufacturerSearchTerm,
    combinedLoading,
  } = useFilterContext();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debug log to track manufacturers data
  useEffect(() => {
    console.log(
      'ManufacturerFilterContainer - Manufacturers:',
      manufacturers?.length || 0,
      'items'
    );
  }, [manufacturers]);

  // Transform manufacturers to match the expected format
  const transformedManufacturers =
    manufacturers?.map((m) => ({
      value: m.name,
      label: m.name,
    })) || [];

  // Combined function to select manufacturer and close dropdown
  const selectManufacturerAndClose = (value: string) => {
    handleManufacturerSelect(value);
    // This assumes handleManufacturerSelect will close the dropdown internally
  };

  return (
    <ManufacturerFilter
      manufacturers={transformedManufacturers}
      selectedManufacturer={selectedManufacturer}
      manufacturerSearchTerm={manufacturerSearchTerm || ''}
      setManufacturerSearchTerm={setManufacturerSearchTerm}
      selectManufacturerAndClose={selectManufacturerAndClose}
      combinedLoading={combinedLoading || false}
      activeDropdown={activeDropdown}
      dropdownRef={dropdownRef}
      toggleDropdown={toggleDropdown}
    />
  );
};

export default ManufacturerFilterContainer;
