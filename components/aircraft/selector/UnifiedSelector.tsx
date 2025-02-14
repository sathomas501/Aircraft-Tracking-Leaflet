// UnifiedSelector.tsx
import React, { useState, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import NNumberSelector from './nNumberSelector';
import { Aircraft, SelectOption } from '@/types/base';

interface ActiveModel {
  model: string;
  label: string;
  activeCount: number;
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
  onModelsUpdate: (models: ActiveModel[]) => void;
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
}) => {
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>(
    'manufacturer'
  );
  const [nNumber, setNNumber] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [models, setModels] = useState<ActiveModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const pollForActiveModels = async (
    manufacturer: string,
    maxAttempts = 3
  ): Promise<boolean> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(
          `[Polling] Attempt ${attempt + 1} of ${maxAttempts} for ${manufacturer}`
        );

        const response = await fetch(
          `/api/aircraft/models?manufacturer=${manufacturer}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch active models');
        }

        const data = await response.json();
        console.log('[Polling] Active models response:', data);

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const activeModels: ActiveModel[] = data.data.map(
            (model: { model: string; activeCount: number }) => ({
              model: model.model,
              label: `${model.model} (${model.activeCount} active)`,
              activeCount: model.activeCount,
            })
          );

          console.log('[Polling] Found active models:', activeModels);
          setModels(activeModels);
          onModelsUpdate(activeModels);
          return true;
        }

        console.log('[Polling] Waiting for active aircraft data...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('[Polling] Error checking for active models:', error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log('[Polling] Max attempts reached without finding active models');
    return false;
  };

  const handleManufacturerSelect = async (manufacturer: string | null) => {
    try {
      if (!manufacturer) {
        setSelectedManufacturer(null);
        setSelectedModel('');
        setModels([]);
        onModelsUpdate([]);
        onReset();
        return;
      }

      setIsLoadingModels(true);
      setModels([]);
      setSelectedModel('');

      console.log('[Manufacturer] Starting tracking for:', manufacturer);
      await onManufacturerSelect(manufacturer);

      const success = await pollForActiveModels(manufacturer);
      if (!success) {
        console.log('[Manufacturer] No active models found after polling');
        onError('No active aircraft found for this manufacturer');
      }
    } catch (error) {
      console.error('[Manufacturer] Error:', error);
      onError('Failed to process manufacturer selection');
      setSelectedManufacturer(null);
      setSelectedModel('');
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // UnifiedSelector.tsx
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
          console.log(`[N-Number] Aircraft not found for N-Number: ${nNumber}`);
          return null;
        }
        throw new Error('Failed to fetch aircraft');
      }

      const data = await response.json();
      if (data.positions && data.positions.length > 0) {
        const aircraftData = data.positions[0];
        console.log(`[N-Number] Found aircraft:`, aircraftData);

        return {
          icao24: aircraftData.icao24 || '',
          'N-NUMBER': aircraftData.n_number || '',
          manufacturer: aircraftData.manufacturer || '',
          model: aircraftData.model || '',
          operator: aircraftData.operator || '',
          latitude: 0,
          longitude: 0,
          altitude: 0,
          heading: 0,
          velocity: 0,
          on_ground: false,
          last_contact: Math.floor(Date.now() / 1000),
          lastSeen: Date.now(),
          NAME: aircraftData.name || '',
          CITY: aircraftData.city || '',
          STATE: aircraftData.state || '',
          OWNER_TYPE: aircraftData.owner_type || '',
          TYPE_AIRCRAFT: aircraftData.type_aircraft || '',
          isTracked: false,
        };
      }
      return null;
    } catch (error) {
      console.error('[N-Number] Error fetching aircraft:', error);
      onError('Failed to fetch aircraft by N-Number');
      return null;
    }
  };

  const totalActiveCount = models.reduce((sum, m) => sum + m.activeCount, 0);

  return (
    <>
      {!isMinimized ? (
        <div className="bg-white rounded-lg shadow-lg p-4 w-[320px] absolute top-4 left-4 z-[3000]">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 bg-gray-200 rounded-md mr-2 hover:bg-gray-300"
                aria-label="Minimize"
              >
                <Minus size={16} />
              </button>
              <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
            </div>
            <button
              onClick={onReset}
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Reset
            </button>
          </div>

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

          {searchMode === 'manufacturer' ? (
            <>
              <ManufacturerSelector
                manufacturers={manufacturers.map((m) => m.label)}
                selectedManufacturer={selectedManufacturer}
                setSelectedManufacturer={setSelectedManufacturer}
                onSelect={handleManufacturerSelect}
              />

              {selectedManufacturer && (
                <div className="mt-2">
                  <label
                    htmlFor="model-select"
                    className="block text-gray-700 text-sm font-bold mb-2"
                  >
                    Model
                  </label>
                  {isLoadingModels ? (
                    <div className="w-full p-2 text-center text-gray-500">
                      Loading active models...
                    </div>
                  ) : models.length > 0 ? (
                    <select
                      id="model-select"
                      className="w-full p-2 border rounded-md bg-white shadow-sm"
                      value={selectedModel}
                      onChange={(e) => {
                        const selected = e.target.value;
                        console.log(
                          `[ModelSelector] Model selected:`,
                          selected
                        );
                        setSelectedModel(selected);
                        onModelSelect(selected);
                      }}
                    >
                      <option value="">
                        All Models ({totalActiveCount} active)
                      </option>
                      {models.map((m, index) => (
                        <option key={`${m.model}-${index}`} value={m.model}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full p-2 text-center text-gray-500">
                      No active models found
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <NNumberSelector
              nNumber={nNumber}
              setNNumber={setNNumber}
              onSearch={fetchAircraftByNNumber}
            />
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsMinimized(false)}
          className="absolute top-4 left-4 z-[3000] p-2 bg-white rounded-md shadow-lg hover:bg-gray-200"
          aria-label="Expand"
        >
          <Plus size={16} />
        </button>
      )}
    </>
  );
};

export default UnifiedSelector;
