import React, { useEffect } from 'react'; // Add useEffect here
import { ActiveModel } from '@/types/base';
import { useFetchModels } from '../../customHooks/useFetchModels';
import { AircraftModel } from '@/types/aircraft-models';

export interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string | null) => void;
  models: AircraftModel[];
  onModelSelect: (model: string | null) => void;
  trackedAircraftCount: number;
  selectedManufacturer: string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setTrackingStatus?: (status: string) => void;
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
  models,
  onModelSelect,
  isLoading,
  setIsLoading,
  trackedAircraftCount,
  selectedManufacturer,
  setTrackingStatus,
  disabled = false,
}) => {
  // Memoize sorted models to avoid re-sorting on each render.
  const sortedModels = React.useMemo(() => sortModels(models), [models]);

  // Use the hook for model updates
  const {
    updateModels,
    loading: updatingModels,
    updateStatus,
  } = useFetchModels(selectedManufacturer || null);

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

  // Handle update button click
  const handleUpdateModels = async () => {
    // Guard clause to prevent errors if props are missing
    if (!setIsLoading || !setTrackingStatus || !selectedManufacturer) {
      console.warn('Missing required props for updating models');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateModels();
      if (result && setTrackingStatus) {
        setTrackingStatus(`Updated ${result.updated} aircraft models`);
      }
    } catch (error) {
      console.error('Error updating models:', error);
      if (setTrackingStatus) {
        setTrackingStatus('Failed to update models');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update tracking status when update status changes
  useEffect(() => {
    if (updateStatus && setTrackingStatus) {
      setTrackingStatus(updateStatus);
    }
  }, [updateStatus, setTrackingStatus]);

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

      {/* Debug information */}
      <div className="text-xs text-gray-500 mb-2">
        Raw models: {models.length}, Active models:{' '}
        {sortedModels.filter((m) => m.activeCount > 0).length}
      </div>

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
        <div className="mt-1 text-sm text-red-500 p-1 border border-red-200 rounded bg-red-50">
          No live aircraft found in OpenSky
          <span className="block text-xs mt-1 text-gray-600">
            Debug: Models: {models.length}, Raw aircraft count:{' '}
            {trackedAircraftCount || 'unknown'}, ActiveCounts:{' '}
            {models.map((m) => m.activeCount).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(ModelSelector);
