// components/aircraft/tracking/selector/UnifiedSelector.tsx
import React, { useState } from 'react';
import { Plus, Minus, RefreshCw } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import { SelectOption } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-models';

interface UnifiedSelectorProps {
  // Manufacturer selection
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onManufacturerSelect: (manufacturer: string | null) => Promise<void>;

  // Model selection
  activeModels: AircraftModel[];
  selectedModel: string | null;
  onModelSelect: (model: string | null) => void;

  // Actions
  onReset: () => void;
  onRefresh?: () => void;

  // State
  isLoading?: boolean;
  totalActive: number;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onManufacturerSelect,
  activeModels,
  selectedModel,
  onModelSelect,
  onReset,
  onRefresh,
  isLoading = false,
  totalActive = 0,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [status, setStatus] = useState('');

  // Handle manufacturer selection
  const handleManufacturerSelect = async (manufacturer: string | null) => {
    try {
      await onManufacturerSelect(manufacturer);
      setStatus(manufacturer ? `Selected ${manufacturer}` : '');
    } catch (error) {
      console.error('Error selecting manufacturer:', error);
      setStatus('Error selecting manufacturer');
    }
  };

  // Handle model selection
  const handleModelSelect = (model: string | null) => {
    onModelSelect(model);
    setStatus(model ? `Filtered to ${model}` : 'Showing all models');
  };

  // Handle reset
  const handleReset = () => {
    onReset();
    setStatus('Reset selection');
  };

  // Handle refresh
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      setStatus('Refreshing data...');
    }
  };

  // For the minimized state, show just a button
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
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
          onClick={() => setIsMinimized(true)}
          className="p-1 bg-gray-200 rounded-md mr-2 hover:bg-gray-300"
          aria-label="Minimize aircraft selector"
        >
          <Minus size={16} />
        </button>
        <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
        <div className="flex gap-1">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="p-1 bg-green-100 rounded-md hover:bg-green-200"
              disabled={isLoading || !selectedManufacturer}
              title="Refresh tracking data"
            >
              <RefreshCw
                size={16}
                className={isLoading ? 'animate-spin' : ''}
              />
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            disabled={isLoading}
          >
            Reset
          </button>
        </div>
      </div>

      <ManufacturerSelector
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onSelect={handleManufacturerSelect}
        isLoading={isLoading}
      />

      {selectedManufacturer && (
        <ModelSelector
          models={activeModels}
          selectedModel={selectedModel}
          onModelSelect={handleModelSelect}
          onRefresh={onRefresh}
          isLoading={isLoading}
          totalActive={totalActive}
        />
      )}

      {/* Show status */}
      {status && (
        <div className="mt-2 p-2 border rounded bg-gray-50">
          <div className="flex items-center">
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            )}
            <span className="text-sm text-gray-700">{status}</span>
          </div>
        </div>
      )}

      {/* Active model count summary */}
      {selectedManufacturer && (
        <div className="mt-2 text-sm">
          <div className="flex flex-col">
            {totalActive > 0 ? (
              <>
                <span className="text-gray-600">
                  Tracking{' '}
                  <span className="font-medium text-blue-600">
                    {totalActive}
                  </span>{' '}
                  aircraft
                </span>
                <span className="text-gray-600">
                  Across{' '}
                  <span className="font-medium text-blue-600">
                    {activeModels.length}
                  </span>{' '}
                  models
                </span>
              </>
            ) : (
              <span className="text-red-500">No active aircraft found</span>
            )}
          </div>
        </div>
      )}

      {/* Model list preview when there are active models */}
      {selectedManufacturer && activeModels.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 max-h-16 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {activeModels
              .sort((a, b) => (b.activeCount || 0) - (a.activeCount || 0))
              .slice(0, 5)
              .map((model) => (
                <span
                  key={model.model}
                  className="px-1 py-0.5 bg-gray-100 rounded"
                >
                  {model.model} ({model.activeCount || 0})
                </span>
              ))}
            {activeModels.length > 5 && (
              <span className="px-1 py-0.5">
                +{activeModels.length - 5} more...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedSelector;
