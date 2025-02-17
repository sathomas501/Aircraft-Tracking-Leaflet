import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import NNumberSelector from './nNumberSelector';
import {
  Aircraft,
  SelectOption,
  BaseModel,
  StaticModel,
  ActiveModel,
  Model,
} from '@/types/base';

// Local interface for model data
interface ModelData extends BaseModel {
  count: number;
  activeCount?: number;
}

interface UnifiedSelectorProps {
  selectedManufacturer: string | null;
  setSelectedManufacturer: (manufacturer: string | null) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelCounts: Map<string, number>;
  totalActive: number;
  manufacturers: SelectOption[];
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onManufacturerSelect: (manufacturer: string) => Promise<void>;
  onModelSelect: (model: string) => void;
  onReset: () => void;
  onModelsUpdate: (models: StaticModel[]) => void; // Changed from ActiveModel[] to StaticModel[]
  onError: (message: string) => void;
}

export const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedManufacturer,
  selectedModel,
  setSelectedManufacturer,
  setSelectedModel,
  modelCounts,
  totalActive,
  manufacturers,
  onModelSelect,
  onReset,
  onModelsUpdate,
  onError,
  onManufacturerSelect,
  onAircraftUpdate,
}) => {
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>(
    'manufacturer'
  );
  const [nNumber, setNNumber] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [models, setModels] = useState<ModelData[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveAircraft, setLiveAircraft] = useState<Aircraft[]>([]); // Added missing state

  const convertToStaticModel = (models: ModelData[]): StaticModel[] => {
    return models.map((model) => ({
      model: model.model,
      manufacturer: model.manufacturer,
      label: model.label || `${model.model} (${model.count} aircraft)`,
      count: model.count,
    }));
  };

  const pollForActiveModels = async (manufacturer: string) => {
    setIsLoadingModels(true);
    setError(null);

    try {
      console.log(
        `[UnifiedSelector] 🔄 Fetching models for manufacturer: ${manufacturer}`
      );
      const response = await fetch(
        `/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[UnifiedSelector] 📦 Models response:', data);

      if (data.success && Array.isArray(data.data)) {
        const processedModels: ModelData[] = data.data.map((model: any) => ({
          model: model.model,
          manufacturer: model.manufacturer,
          label: model.label || model.model,
          count: model.count || 0,
          activeCount: model.activeCount || 0,
        }));

        console.log('[UnifiedSelector] ✅ Processed models:', processedModels);
        setModels(processedModels);
        onModelsUpdate(convertToStaticModel(processedModels));
      } else {
        console.log('[UnifiedSelector] ⚠️ No models in response:', data);
        setModels([]);
        onModelsUpdate([]);
      }
    } catch (error) {
      console.error('[UnifiedSelector] ❌ Error:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to fetch models'
      );
      onError('Failed to fetch models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleManufacturerSelect = async (
    manufacturer: string | null
  ): Promise<Aircraft[]> => {
    try {
      if (!manufacturer) {
        console.log('[UnifiedSelector] 🔄 Resetting manufacturer selection');
        setSelectedManufacturer(null);
        setSelectedModel('');
        setModels([]);
        onModelsUpdate([]);
        onReset();
        return [];
      }

      console.log(
        '[UnifiedSelector] 🔍 Processing manufacturer selection:',
        manufacturer
      );
      setSelectedManufacturer(manufacturer);
      setIsLoadingModels(true);
      setModels([]);
      setSelectedModel('');

      // First get active aircraft for the manufacturer
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch aircraft: ${response.statusText}`);
      }

      const data = await response.json();
      const aircraft: Aircraft[] = data.aircraft || [];

      // Now get the models
      console.log('[UnifiedSelector] 📡 Polling for active models');
      await pollForActiveModels(manufacturer);

      // Update the UI
      onAircraftUpdate(aircraft);

      return aircraft;
    } catch (error) {
      console.error('[UnifiedSelector] ❌ Error processing selection:', error);
      onError('Failed to process manufacturer selection');
      setSelectedManufacturer(null);
      setSelectedModel('');
      setModels([]);
      return [];
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleModelsUpdate = (inputModels: Model[]) => {
    const processedModels: ModelData[] = inputModels.map((m) => ({
      model: m.model,
      manufacturer: m.manufacturer || '',
      label: m.label || m.model,
      count: m.activeCount || 0,
      activeCount: m.activeCount || 0,
    }));

    onModelsUpdate(convertToStaticModel(processedModels));
  };

  const fetchAircraftByNNumber = async (
    nNumber: string
  ): Promise<Aircraft | null> => {
    try {
      const response = await fetch('/api/aircraft/n-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nNumber }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[N-Number] Aircraft not found for: ${nNumber}`);
          return null;
        }
        throw new Error('Failed to fetch aircraft');
      }

      const data = await response.json();
      if (data.positions && data.positions.length > 0) {
        return data.positions[0];
      }

      return null;
    } catch (error) {
      console.error('[N-Number] Error:', error);
      onError('Failed to fetch aircraft by N-Number');
      return null;
    }
  };

  return (
    <>
      {!isMinimized ? (
        <div className="bg-white rounded-lg shadow-lg p-4 w-[320px] absolute top-4 left-4 z-[3000]">
          {/* Header with minimize and reset buttons */}
          <div className="flex justify-between items-center mb-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 bg-gray-200 rounded-md mr-2 hover:bg-gray-300"
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

          {/* Search mode toggle buttons */}
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setSearchMode('manufacturer')}
              className={`flex-1 py-2 px-4 rounded-md ${
                searchMode === 'manufacturer'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              By Manufacturer
            </button>
            <button
              onClick={() => setSearchMode('nNumber')}
              className={`flex-1 py-2 px-4 rounded-md ${
                searchMode === 'nNumber'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              By N-Number
            </button>
          </div>

          {/* Manufacturer search section */}
          {searchMode === 'manufacturer' ? (
            <>
              <ManufacturerSelector
                manufacturers={manufacturers}
                selectedManufacturer={selectedManufacturer}
                setSelectedManufacturer={setSelectedManufacturer}
                onSelect={handleManufacturerSelect}
                onAircraftUpdate={onAircraftUpdate}
                onError={(message) =>
                  console.error('[UnifiedSelector] ❌', message)
                }
              />

              {/* Model selector section */}
              {selectedManufacturer && (
                <div className="mt-2">
                  {isLoadingModels ? (
                    <div className="w-full p-2 text-center text-gray-500">
                      Loading models...
                    </div>
                  ) : (
                    <ModelSelector
                      selectedModel={selectedModel}
                      setSelectedModel={setSelectedModel}
                      models={convertToStaticModel(models)}
                      totalActive={totalActive}
                      onModelSelect={onModelSelect}
                    />
                  )}
                  {error && (
                    <div className="text-red-500 text-sm mt-1">{error}</div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* N-Number search section */
            <NNumberSelector
              nNumber={nNumber}
              setNNumber={setNNumber}
              onSearch={fetchAircraftByNNumber}
            />
          )}

          {/* Status or error messages */}
          {error && (
            <div className="mt-2 p-2 bg-red-100 text-red-600 rounded">
              {error}
            </div>
          )}
        </div>
      ) : (
        /* Minimized state */
        <button
          onClick={() => setIsMinimized(false)}
          className="absolute top-4 left-4 z-[3000] p-2 bg-white rounded-md shadow-lg hover:bg-gray-200"
        >
          <Plus size={16} />
        </button>
      )}
    </>
  );
};

export default UnifiedSelector;
