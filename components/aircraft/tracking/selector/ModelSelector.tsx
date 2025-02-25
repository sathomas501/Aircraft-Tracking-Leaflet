import React from 'react';
import { ActiveModel } from '@/types/base';

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: ActiveModel[];
  totalActive?: number;
  onModelSelect: (model: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Helper to sort models by descending activeCount and then alphabetically.
 */
const sortModels = (models: ActiveModel[]): ActiveModel[] => {
  return [...models].sort((a, b) => {
    const countDiff = b.activeCount - a.activeCount;
    return countDiff !== 0 ? countDiff : a.model.localeCompare(b.model);
  });
};

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  onModelSelect,
  models,
  totalActive = 0,
  isLoading = false,
  disabled = false,
}) => {
  // Memoize sorted models to avoid re-sorting on each render.
  const sortedModels = React.useMemo(() => sortModels(models), [models]);

  // Compute total active count if not provided.
  const actualTotalActive = React.useMemo(
    () =>
      totalActive || models.reduce((sum, model) => sum + model.activeCount, 0),
    [totalActive, models]
  );

  return (
    <div className="mt-2">
      <label
        htmlFor="model-select"
        className="block text-gray-700 text-sm font-bold mb-2"
      >
        Model{' '}
        {isLoading && <span className="text-blue-500 ml-2">(Loading...)</span>}
      </label>
      <select
        id="model-select"
        className={`w-full p-2 border rounded-md bg-white shadow-sm
          ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${!selectedModel ? 'text-gray-500' : 'text-gray-900'}
          hover:border-blue-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500
        `}
        value={selectedModel}
        onChange={(e) => {
          const selected = e.target.value;
          setSelectedModel(selected);
          onModelSelect(selected);
        }}
        disabled={disabled || isLoading}
      >
        <option value="" className="text-gray-500">
          All Models ({actualTotalActive} active)
        </option>
        {sortedModels.map((model) => (
          <option
            key={model.model}
            value={model.model}
            className={`
              ${model.activeCount > 0 ? 'font-semibold text-blue-700' : 'text-gray-700'}
              ${model.activeCount > 5 ? 'bg-blue-50' : ''}
            `}
          >
            {`${model.model} (${model.activeCount} active${
              model.totalCount ? ` of ${model.totalCount}` : ''
            })`}
          </option>
        ))}
      </select>
      {models.length === 0 && !isLoading && (
        <p className="mt-1 text-sm text-gray-500">No models available</p>
      )}
    </div>
  );
};

export default React.memo(ModelSelector);
