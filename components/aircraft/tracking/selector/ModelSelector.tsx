// ModelSelector.tsx
import React, { useEffect } from 'react';
import { useModels } from '../ModelContext';
import { RefreshCw } from 'lucide-react';
import { AircraftModel } from '@/types/aircraft-models';

interface ModelSelectorProps {
  onModelSelect?: (model: string | null) => void;
  className?: string;
  disabled?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  onModelSelect,
  className = '',
  disabled = false,
}) => {
  const {
    models,
    selectedModel,
    setSelectedModel,
    isLoading,
    refreshModels,
    status,
    totalActive,
    totalInactive,
  } = useModels();

  // Synchronize model selection with parent component
  useEffect(() => {
    if (onModelSelect && selectedModel !== undefined) {
      onModelSelect(selectedModel);
    }
  }, [selectedModel, onModelSelect]);

  // Format option label
  const formatOptionLabel = (model: AircraftModel) => {
    const totalCount = model.totalCount || model.count || 0;
    const activeCount = model.activeCount || 0;
    const inactiveCount = totalCount - activeCount;

    if (activeCount > 0) {
      return `${model.model} (${activeCount} active, ${inactiveCount} inactive)`;
    } else {
      return `${model.model} (${inactiveCount} inactive)`;
    }
  };

  // Handle model selection change
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedModel(value || null);
  };

  return (
    <div className={`mt-4 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <label
          htmlFor="model-select"
          className="block text-gray-700 text-sm font-bold"
        >
          Aircraft Model
          {isLoading && (
            <span className="ml-2 text-blue-500 text-xs">(Loading...)</span>
          )}
        </label>

        <button
          className={`text-xs px-2 py-1 rounded flex items-center 
            ${
              isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
            }`}
          onClick={refreshModels}
          disabled={isLoading || disabled}
          title="Refresh model data"
        >
          <RefreshCw
            size={12}
            className={`mr-1 ${isLoading ? 'animate-spin' : ''}`}
          />
          {isLoading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <select
        id="model-select"
        className={`w-full p-2 border rounded-md ${
          disabled || isLoading
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer'
        } ${!selectedModel ? 'text-gray-500' : 'text-gray-900'}`}
        value={selectedModel || ''}
        onChange={handleModelChange}
        disabled={isLoading || models.length === 0 || disabled}
      >
        <option value="">
          {totalActive > 0
            ? `All Models (${totalActive} active, ${totalInactive} inactive)`
            : `All Models (${totalInactive} inactive)`}
        </option>

        {models.map((model) => (
          <option
            key={model.model}
            value={model.model}
            className={`
              ${model.activeCount && model.activeCount > 0 ? 'font-medium text-blue-700' : 'text-gray-700'}
            `}
          >
            {formatOptionLabel(model)}
          </option>
        ))}
      </select>

      {models.length === 0 && !isLoading && (
        <p className="mt-1 text-sm text-gray-500">No models available</p>
      )}

      {totalActive === 0 && models.length > 0 && (
        <div className="mt-1 text-sm text-red-500 p-1 border border-red-200 rounded bg-red-50">
          No live aircraft found
        </div>
      )}

      {status && <div className="mt-1 text-xs text-gray-500">{status}</div>}
    </div>
  );
};

export default React.memo(ModelSelector);
