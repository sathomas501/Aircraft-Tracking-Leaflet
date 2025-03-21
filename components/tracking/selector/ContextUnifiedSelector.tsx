// components/tracking/selector/ContextUnifiedSelector.tsx
import React, { useState } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import type { SelectOption } from '@/types/base';

interface ContextUnifiedSelectorProps {
  manufacturers: SelectOption[];
}

const ContextUnifiedSelector: React.FC<ContextUnifiedSelectorProps> = ({
  manufacturers,
}) => {
  // Get state and actions from context
  const {
    selectedManufacturer,
    selectedModel,
    activeModels,
    isLoading,
    totalActive,
    selectManufacturer,
    selectModel,
    reset,
    fullRefresh,
  } = useEnhancedMapContext();

  // Local state for minimized view
  const [isMinimized, setIsMinimized] = useState(false);

  // Toggle minimized state
  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  // Create model options from active models
  const modelOptions = activeModels.map((model) => ({
    value: model.model,
    label: `${model.model} (${model.count})`,
  }));

  // Handle manufacturer change
  const handleManufacturerChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = event.target.value;
    selectManufacturer(value === '' ? null : value);
  };

  // Handle model change
  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    selectModel(value === '' ? null : value);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      {/* Header with toggle */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold">Aircraft Selector</h2>
        <button
          onClick={toggleMinimized}
          className="p-1 hover:bg-gray-100 rounded"
        >
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {/* Content (conditionally hidden) */}
      {!isMinimized && (
        <>
          {/* Manufacturer Selector */}
          <div className="mb-4">
            <label
              htmlFor="manufacturer"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Manufacturer
            </label>
            <select
              id="manufacturer"
              value={selectedManufacturer || ''}
              onChange={handleManufacturerChange}
              disabled={isLoading}
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Manufacturer</option>
              {manufacturers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector (only if manufacturer selected) */}
          {selectedManufacturer && (
            <div className="mb-4">
              <label
                htmlFor="model"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Aircraft Model
              </label>
              <select
                id="model"
                value={selectedModel || ''}
                onChange={handleModelChange}
                disabled={isLoading || activeModels.length === 0}
                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Models ({totalActive})</option>
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => reset()}
              disabled={isLoading || !selectedManufacturer}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                isLoading || !selectedManufacturer
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              Reset
            </button>

            <button
              onClick={() => fullRefresh()}
              disabled={isLoading || !selectedManufacturer}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                isLoading || !selectedManufacturer
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              Refresh
            </button>
          </div>
        </>
      )}

      {/* Status Bar (always visible) */}
      {selectedManufacturer && (
        <div
          className={`${isMinimized ? 'mt-0' : 'mt-3'} text-sm text-gray-600`}
        >
          {isLoading ? (
            <div className="flex items-center">
              <svg
                className="animate-spin h-4 w-4 mr-2 text-blue-500"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading aircraft data...
            </div>
          ) : (
            <>
              Tracking <span className="font-bold">{totalActive}</span> aircraft
              {selectedModel && ` (filtered to ${selectedModel})`}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextUnifiedSelector;
