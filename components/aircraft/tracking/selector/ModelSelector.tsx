import React from 'react';
import { Model, ActiveModel, StaticModel } from '@/types/base';

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: ActiveModel[];
  totalActive?: number;
  onModelSelect: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  onModelSelect,
  models,
  totalActive = 0,
}) => {
  const sortedModels = React.useMemo(
    () => [...models].sort((a, b) => b.activeCount - a.activeCount),
    [models]
  );

  return (
    <div className="mt-2">
      <label
        htmlFor="model-select"
        className="block text-gray-700 text-sm font-bold mb-2"
      >
        Model
      </label>
      <select
        id="model-select"
        className="w-full p-2 border rounded-md bg-white shadow-sm"
        value={selectedModel}
        onChange={(e) => {
          const selected = e.target.value;
          setSelectedModel(selected);
          onModelSelect(selected);
        }}
      >
        <option value="">All Models ({totalActive} active)</option>
        {sortedModels.map((model) => (
          <option
            key={model.model}
            value={model.model}
            className={
              model.activeCount > 0 ? 'font-semibold text-blue-700' : ''
            }
          >
            {`${model.model} (${model.activeCount} active)`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;
