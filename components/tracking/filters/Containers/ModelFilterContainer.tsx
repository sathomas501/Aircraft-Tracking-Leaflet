import React from 'react';
import ModelFilter from '../ModelFilter';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import { useModelFilter } from '../../hooks/useModelFilter';

const ModelFilterContainer: React.FC<{ applyAllFilters: () => void }> = ({
  applyAllFilters,
}) => {
  const {
    selectedManufacturer,
    activeDropdown,
    toggleDropdown,
    dropdownRefs,
    totalActive,
    activeModels, // optional if you're transforming manually
  } = useEnhancedMapContext();

  const { selectedModel, modelOptions, isLoading, handleModelSelect } =
    useModelFilter(selectedManufacturer, applyAllFilters);

  // Optional: transform plain model strings to ModelOption[]
  const transformedModels = modelOptions.map((model) => ({
    value: model,
    label: model,
    count: 0, // if needed by UI, or remove from type
  }));

  return (
    <ModelFilter
      selectedManufacturer={selectedManufacturer}
      selectedModel={selectedModel}
      handleModelSelect={handleModelSelect}
      activeDropdown={activeDropdown}
      toggleDropdown={toggleDropdown}
      dropdownRef={dropdownRefs.model}
      totalActive={totalActive}
      activeModels={transformedModels}
    />
  );
};

export default ModelFilterContainer;
