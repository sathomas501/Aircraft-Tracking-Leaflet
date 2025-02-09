import React, { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Model {
  model: string;
  label: string;
  activeCount?: number;
  count?: number;
}

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedManufacturer: string;
  models: Model[];
  totalActive: number;
  onModelUpdate: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  selectedManufacturer,
  models = [],
  totalActive,
  onModelUpdate,
}) => {
  useEffect(() => {
    if (selectedModel && !models.some((m) => m.model === selectedModel)) {
      setSelectedModel('');
    }
  }, [selectedManufacturer, models, selectedModel, setSelectedModel]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-600">Model</label>
      <div className="relative">
        <select
          value={selectedModel}
          onChange={(e) => {
            setSelectedModel(e.target.value);
            onModelUpdate(e.target.value);
          }}
          className="w-full p-2 pr-8 border border-gray-300 rounded-md shadow-sm 
                     focus:ring-blue-500 focus:border-blue-500 
                     bg-white text-gray-900 appearance-none
                     disabled:bg-gray-100 disabled:text-gray-500"
          disabled={!selectedManufacturer}
        >
          <option value="">
            {selectedManufacturer
              ? `All Models (${totalActive} active)`
              : 'Select a manufacturer first'}
          </option>
          {models.map((model) => (
            <option key={model.model} value={model.model}>
              {model.label} ({model.activeCount || 0} active /{' '}
              {model.count?.toLocaleString() || 0} total)
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-2 top-3 text-gray-500"
          size={16}
        />
      </div>
    </div>
  );
};

export default React.memo(ModelSelector);
