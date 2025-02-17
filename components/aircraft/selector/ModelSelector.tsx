import React from 'react';
import { StaticModel } from '@/types/base';

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: StaticModel[];
  totalActive?: number;
  onModelSelect: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  models,
  totalActive = 0,
  onModelSelect,
}) => {
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
          console.log(`[ModelSelector] Selected model: ${selected}`);
          setSelectedModel(selected);
          onModelSelect(selected);
        }}
      >
        <option value="">All Models ({totalActive} total)</option>
        {models.map((model) => (
          <option key={model.model} value={model.model}>
            {model.label || `${model.model} (${model.count} aircraft)`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;
