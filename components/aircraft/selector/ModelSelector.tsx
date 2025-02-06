import React, { useEffect, useState } from 'react';
import { useFetchModels } from '../customHooks/useFetchModels';
import { Model } from '../selector/services/aircraftService';
import {
  useErrorHandler,
  ErrorType,
} from '../../../lib/services/error-handler';

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
  onSelect,
}) => {
  const { models, loading } = useFetchModels(selectedManufacturer);
  const { error, clearError } = useErrorHandler(ErrorType.DATA);
  const [localModels, setLocalModels] = useState<Model[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(
          `/api/aircraft/models?manufacturer=${selectedManufacturer}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Fetched Models:', data);
        setLocalModels(data.models || []);
        clearError(); // Clear errors on successful fetch
      } catch (err) {
        console.error('Error fetching models:', err);
        throw err; // Throwing the error to trigger the global error handler
      }
    };

    if (selectedManufacturer) {
      fetchModels();
    }
  }, [selectedManufacturer, clearError]);

  return (
    <div className="px-4 pb-4">
      {error && (
        <div className="text-red-500 text-sm mb-2">
          {error.message}
          <button onClick={clearError} className="ml-2 text-blue-500 underline">
            Dismiss
          </button>
        </div>
      )}

      <select
        value={selectedModel}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full p-2 border border-blue-200 rounded bg-white"
        disabled={loading}
      >
        <option value="">All Models</option>
        {localModels.map((modelItem: Model) => (
          <option key={modelItem.model} value={modelItem.model}>
            {modelItem.model} ({modelCounts.get(modelItem.model) || 0})
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;
