import React, { useState, useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';
import { UnifiedSelectorProps } from '../selector/types';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import { useAircraftSelector } from '../../customHooks/useAircraftSelector';

export const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  manufacturers,
  onError,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  // Use the hook for all data and selection logic
  const {
    selectedManufacturer,
    selectedModel,
    models,
    allAircraft,
    filteredAircraft,
    handleManufacturerSelect,
    handleModelSelect,
    aircraftCount,
  } = useAircraftSelector({
    onError: (message) => {
      if (onError) onError(message);
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('');

  // Simply toggle the minimized state
  const handleToggle = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Reset handler - this will clear selections in the hook
  const handleReset = useCallback(() => {
    handleManufacturerSelect(null);
  }, [handleManufacturerSelect]);

  // For the minimized state, show just a button
  if (isMinimized) {
    return (
      <button
        onClick={handleToggle}
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
          onClick={handleToggle}
          className="p-1 bg-gray-200 rounded-md mr-2 hover:bg-gray-300"
          aria-label="Minimize aircraft selector"
        >
          <Minus size={16} />
        </button>
        <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
        <button
          onClick={handleReset}
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Reset
        </button>
      </div>

      <ManufacturerSelector
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onSelect={handleManufacturerSelect}
        isLoading={isLoading}
        onError={onError}
      />

      {selectedManufacturer && (
        <ModelSelector
          selectedModel={selectedModel || ''}
          setSelectedModel={handleModelSelect}
          models={models}
          onModelSelect={handleModelSelect}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          trackedAircraftCount={allAircraft.length}
          selectedManufacturer={selectedManufacturer}
          setTrackingStatus={setTrackingStatus}
        />
      )}

      {/* Show tracking status */}
      {trackingStatus && (
        <div className="mt-2 p-2 border rounded bg-gray-50">
          <div className="flex items-center">
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            )}
            <span className="text-sm text-gray-700">{trackingStatus}</span>
          </div>
        </div>
      )}

      {/* Show aircraft count if available */}
      {aircraftCount > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          Found {filteredAircraft.length} of {aircraftCount} aircraft
        </div>
      )}
    </div>
  );
};

export default UnifiedSelector;
