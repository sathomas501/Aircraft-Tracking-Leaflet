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
    const countDiff = (b.activeCount || 0) - (a.activeCount || 0);
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

  // Directly use model data to format option labels
  const formatOptionLabel = (model: ActiveModel) => {
    const totalCount = model.totalCount || model.count || 0;
    const activeCount = model.activeCount || 0;
    const inactiveCount = totalCount - activeCount;

    if (activeCount > 0) {
      return `${model.model} (${activeCount} active, ${inactiveCount} inactive)`;
    } else {
      return `${model.model} (${inactiveCount} inactive)`;
    }
  };

  // Compute total numbers for header option
  const totalInactiveCount = React.useMemo(
    () =>
      models.reduce(
        (sum, model) =>
          sum +
          ((model.totalCount || model.count || 0) - (model.activeCount || 0)),
        0
      ),
    [models]
  );

  // Calculate total active aircraft across all models
  const actualTotalActive = React.useMemo(
    () => models.reduce((sum, model) => sum + (model.activeCount || 0), 0),
    [models]
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
          {actualTotalActive > 0
            ? `All Models (${actualTotalActive} active, ${totalInactiveCount} inactive)`
            : `All Models (${totalInactiveCount} inactive)`}
        </option>
        {sortedModels.map((model) => (
          <option
            key={model.model}
            value={model.model}
            className={`
              ${model.activeCount && model.activeCount > 0 ? 'font-semibold text-blue-700' : 'text-gray-700'}
              ${model.activeCount && model.activeCount > 5 ? 'bg-blue-50' : ''}
            `}
          >
            {formatOptionLabel(model)}
          </option>
        ))}
      </select>
      {models.length === 0 && !isLoading && (
        <p className="mt-1 text-sm text-gray-500">No models available</p>
      )}
      {actualTotalActive === 0 && models.length > 0 && (
        <p className="mt-1 text-sm text-gray-500">
          No live aircraft found in OpenSky
        </p>
      )}
    </div>
  );
};

export default React.memo(ModelSelector);
