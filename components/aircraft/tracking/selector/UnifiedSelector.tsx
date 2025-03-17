// UnifiedSelector.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import { ModelProvider } from '../ModelContext';
import { SelectOption, Aircraft } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-models';
import { useResetState } from '../../../../hooks/useResetState';

export interface UnifiedSelectorProps {
  // Data props
  manufacturers: SelectOption[];
  selectedManufacturer: string;
  selectedModel: string;
  totalActive: number;

  // Handler props
  setSelectedManufacturer: (manufacturer: string | null) => void;
  setSelectedModel: (model: string | null) => void;
  onManufacturerSelect: (manufacturer: string | null) => Promise<void>;
  onModelSelect: (model: string | null) => void;
  onReset: () => void;
  onError: (message: string) => void;
  onAircraftUpdate?: (aircraft: Aircraft[]) => void;

  // UI state props (optional)
  isLoading?: boolean;
  trackingStatus?: string;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  selectedModel,
  setSelectedManufacturer,
  setSelectedModel,
  onManufacturerSelect,
  onModelSelect,
  totalActive,
  onReset,
  onError,
  onAircraftUpdate,
  isLoading = false,
  trackingStatus = '',
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [localIsLoading, setLocalIsLoading] = useState(isLoading);
  const [localTrackingStatus, setLocalTrackingStatus] =
    useState(trackingStatus);

  // Update local state when props change
  useEffect(() => {
    setLocalIsLoading(isLoading);
  }, [isLoading]);

  useEffect(() => {
    setLocalTrackingStatus(trackingStatus);
  }, [trackingStatus]);

  // Simply toggle the minimized state
  const handleToggle = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Reset local state function for the reset hook
  const resetLocalState = useCallback(() => {
    // Reset any local state in UnifiedSelector if needed
    console.log('[UnifiedSelector] Resetting local state');
  }, []);

  // Use our reset hook to handle the reset
  const resetParentState = useCallback(async () => {
    console.log('[UnifiedSelector] Calling parent reset');
    onReset();
  }, [onReset]);

  const { handleReset, isResetting } = useResetState({
    resetLocalState,
    resetParentState,
    onError: (error) => onError('Reset operation failed: ' + error.message),
  });

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
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          disabled={localIsLoading || isResetting}
        >
          {isResetting ? 'Resetting...' : 'Reset'}
        </button>
      </div>

      <ManufacturerSelector
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onSelect={onManufacturerSelect}
        isLoading={localIsLoading || isResetting}
        onError={onError}
      />

      {selectedManufacturer && (
        <ModelProvider
          manufacturer={selectedManufacturer}
          onStatusChange={setLocalTrackingStatus}
        >
          <ModelSelector
            onModelSelect={onModelSelect}
            disabled={localIsLoading || isResetting}
          />
        </ModelProvider>
      )}

      {/* Show tracking status */}
      {localTrackingStatus && (
        <div className="mt-2 p-2 border rounded bg-gray-50">
          <div className="flex items-center">
            {(localIsLoading || isResetting) && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            )}
            <span className="text-sm text-gray-700">{localTrackingStatus}</span>
          </div>
        </div>
      )}

      {/* Show aircraft count if available */}
      {totalActive > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          <div className="flex items-center">
            <span>Tracking</span>
            <span className="ml-1 font-medium text-blue-600">
              {totalActive}
            </span>
            <span className="ml-1">aircraft</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedSelector;
