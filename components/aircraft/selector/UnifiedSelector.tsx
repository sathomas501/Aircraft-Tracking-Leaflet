import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import { Aircraft, StaticModel, SelectOption, ActiveModel } from '@/types/base';

interface UnifiedSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedManufacturer: (manufacturer: string | null) => void;
  setSelectedModel: (model: string) => void;
  onManufacturerSelect: (manufacturer: string | null) => Promise<void>;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: StaticModel[]) => void; // Updated to match ManufacturerSelector
  onReset: () => void;
  onError: (message: string) => void;
  models: StaticModel[];
  modelCounts: Record<string, number>;
  totalActive?: number;
}

export const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  selectedModel,
  setSelectedManufacturer,
  setSelectedModel,
  onManufacturerSelect,
  onModelSelect,
  onAircraftUpdate,
  onModelsUpdate,
  onReset,
  onError,
  models,
  modelCounts,
  totalActive = 0,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggle = () => setIsMinimized((prev) => !prev);

  // Convert Aircraft[] to StaticModel[] for onModelsUpdate
  const handleModelsUpdate = (aircraft: Aircraft[]): void => {
    const staticModels: StaticModel[] = aircraft.map((aircraft) => ({
      model: aircraft.model || '',
      manufacturer: aircraft.manufacturer,
      label: `${aircraft.model || 'Unknown'} (${aircraft.isTracked ? '1' : '0'} active)`,
      count: 1,
    }));
    onModelsUpdate(staticModels);
  };

  const processedModels: ActiveModel[] = data.data.map((model: any) => ({
    model: model.model,
    manufacturer: model.manufacturer,
    label: `${model.model} (${model.activeCount ?? 0} active)`,
    activeCount: model.activeCount ?? 0,
    totalCount: model.totalCount ?? model.count ?? 0,
  }));

  // Process models with counts
  const fetchModels = async (manufacturer: string) => {
    try {
      const response = await fetch(
        `/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json(); // ✅ Ensure data is retrieved before mapping

      if (!data || !data.data) {
        throw new Error('Invalid response format');
      }

      const [models, setModels] = useState<ActiveModel[]>([]); // ✅ Correct use of useState

      setModels(processedModels);
    } catch (error) {
      console.error('[UnifiedSelector] ❌ Error fetching models:', error);
    }
  };

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
          onClick={onReset}
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Reset
        </button>
      </div>

      <ManufacturerSelector
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onSelect={onManufacturerSelect}
        onAircraftUpdate={onAircraftUpdate}
        onModelsUpdate={onModelsUpdate} // Now expects StaticModel[]
        onError={onError}
      />

      {selectedManufacturer && (
        <ModelSelector
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          models={processedModels}
          totalActive={totalActive}
          onModelSelect={onModelSelect}
        />
      )}
    </div>
  );
};
