import React, { useState, useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';
import { UnifiedSelectorProps } from '../selector/types';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';

export const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  selectedModel,
  setSelectedManufacturer,
  setSelectedModel,
  onManufacturerSelect,
  onModelSelect,
  onAircraftUpdate,
  onModelsUpdate,
  onReset,
  onError,
  models,
  modelCounts,
  totalActive = 0,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggle = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Process models with counts
  const processedModels = React.useMemo(
    () =>
      models.map((model) => ({
        ...model,
        label: `${model.model} (${modelCounts[model.model] || 0} active)`,
      })),
    [models, modelCounts]
  );

  if (isMinimized) {
    return (
      <button
        onClick={handleToggle}
        className="absolute top-4 left-4 z-[3000] p-2 bg-white rounded-md shadow-lg hover:bg-gray-200"
        aria-label="Expand aircraft selector"
      >
        <Plus size={16} />
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-[320px] absolute top-4 left-4 z-[3000]">
      <div className="flex justify-between items-center mb-2">
        <button
          onClick={handleToggle}
          className="p-1 bg-gray-200 rounded-md mr-2 hover:bg-gray-300"
          aria-label="Minimize aircraft selector"
        >
          <Minus size={16} />
        </button>
        <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
        <button
          onClick={onReset}
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Reset
        </button>
      </div>

      <ManufacturerSelector
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onSelect={onManufacturerSelect}
        onAircraftUpdate={onAircraftUpdate}
        onModelsUpdate={onModelsUpdate}
        onError={onError}
      />

      {selectedManufacturer && (
        <ModelSelector
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          models={processedModels}
          totalActive={totalActive}
          onModelSelect={onModelSelect}
        />
      )}
    </div>
  );
};

export default UnifiedSelector;
