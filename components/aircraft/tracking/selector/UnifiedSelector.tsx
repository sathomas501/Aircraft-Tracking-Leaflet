// SimplifiedUnifiedSelector.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import { SelectOption } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-models';

interface UnifiedSelectorProps {
  manufacturers: SelectOption[];
  onManufacturerSelect: (manufacturer: string | null) => Promise<void>;
  onModelSelect: (model: string | null) => void;
  onReset: () => void;
  totalActive?: number;
  isLoading?: boolean;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  manufacturers,
  onManufacturerSelect,
  onModelSelect,
  onReset,
  totalActive = 0,
  isLoading = false,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [models, setModels] = useState<AircraftModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [status, setStatus] = useState('');

  // Load models when manufacturer changes
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedManufacturer) {
        setModels([]);
        return;
      }

      setLoadingModels(true);
      try {
        const response = await fetch('/api/aircraft/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manufacturer: selectedManufacturer,
            refresh: true, // Optional, if needed
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch models: ${errorText}`);
        }

        const data = await response.json();
        setModels(data.models || []);
        setStatus(`Loaded ${data.models.length} models`);
      } catch (error) {
        setStatus('Failed to load models');
        console.error('Fetch error:', error);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [selectedManufacturer]);

  // Handle manufacturer selection
  const handleManufacturerSelect = async (manufacturer: string | null) => {
    setSelectedManufacturer(manufacturer);
    setSelectedModel(null);

    if (manufacturer) {
      try {
        await onManufacturerSelect(manufacturer);
      } catch (error) {
        console.error('Error selecting manufacturer:', error);
      }
    }
  };

  // Handle model selection
  const handleModelSelect = (model: string | null) => {
    setSelectedModel(model);
    onModelSelect(model);
  };

  // Handle reset
  const handleReset = () => {
    setSelectedManufacturer(null);
    setSelectedModel(null);
    setModels([]);
    onReset();
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

  // Calculate loading state
  const currentlyLoading = isLoading || loadingModels;

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
        <button
          onClick={handleReset}
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          disabled={currentlyLoading}
        >
          Reset
        </button>
      </div>

      <ManufacturerSelector
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onSelect={handleManufacturerSelect}
        isLoading={currentlyLoading}
      />

      {selectedManufacturer && (
        <ModelSelector
          models={models}
          selectedModel={selectedModel}
          onModelSelect={handleModelSelect}
          isLoading={currentlyLoading}
          totalActive={totalActive}
          totalInactive={
            models.reduce(
              (sum, model) => sum + (model.totalCount || model.count || 0),
              0
            ) - totalActive
          }
        />
      )}

      {/* Show status */}
      {status && (
        <div className="mt-2 p-2 border rounded bg-gray-50">
          <div className="flex items-center">
            {currentlyLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            )}
            <span className="text-sm text-gray-700">{status}</span>
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
