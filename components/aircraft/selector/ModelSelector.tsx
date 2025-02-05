
//components/aircraft/selector/ModelSelector
import React from 'react';
import { useFetchModels } from '../customHooks/useFetchModels';
import { Model } from '../selector/services/aircraftService';

interface ModelSelectorProps {
  selectedModel: string;
  selectedManufacturer: string;
  modelCounts: Map<string, number>;
  onSelect: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  selectedManufacturer,
  modelCounts,
  onSelect
}) => {
  const { models } = useFetchModels(selectedManufacturer);

  return (
    <div className="px-4 pb-4">
      <select
        value={selectedModel}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full p-2 border border-blue-200 rounded bg-white"
      >
        <option value="">All Models</option>
        {models.map((modelItem: Model) => (
          <option key={modelItem.model} value={modelItem.model}>
            {modelItem.model} ({modelCounts.get(modelItem.model) || 0})
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;