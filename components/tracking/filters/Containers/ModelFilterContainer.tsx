// components/tracking/filters/Containers/ModelFilterContainer.tsx
import React, { useRef } from 'react';
import { useFilterContext } from '../../context/FilterContext';
import ModelFilter from '../ModelFilter';

const ModelFilterContainer: React.FC = () => {
  const {
    selectedModel,
    handleModelSelect, // Use the handleModelSelect from context directly
    activeDropdown,
    toggleDropdown,
    models, // Use models from context instead of modelOptions
    activeRegion,
    regionCounts,
  } = useFilterContext();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Models are already in the expected format with name and count
  const modelOptions = models || [];

  return (
    <ModelFilter
      selectedModel={selectedModel}
      handleModelSelect={handleModelSelect}
      activeDropdown={activeDropdown}
      toggleDropdown={toggleDropdown}
      dropdownRef={dropdownRef}
      modelOptions={modelOptions}
      activeRegion={activeRegion}
      regionCounts={regionCounts}
    />
  );
};

export default ModelFilterContainer;
