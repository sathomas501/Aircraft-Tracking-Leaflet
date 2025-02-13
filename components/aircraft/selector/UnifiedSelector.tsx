import React, { useState, useRef } from 'react';
import { Search, Plus, Minus } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import NNumberSelector from './nNumberSelector';
import ModelSelector from './ModelSelector';
import { Aircraft, SelectOption } from '@/types/base';
import { Model } from '../selector/services/aircraftService';

interface UnifiedSelectorProps {
  selectedManufacturer: string | null; // ✅ Allow null values
  setSelectedManufacturer: (manufacturer: string | null) => void; // ✅ Allow null
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelCounts: Map<string, number>;
  totalActive: number;
  manufacturers: SelectOption[];
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onManufacturerSelect: (manufacturer: string) => Promise<void>;
  onModelSelect: (model: string) => void;
  onReset: () => void;
  onModelsUpdate: (
    models: {
      model: string;
      label: string;
      activeCount?: number;
      count?: number;
    }[]
  ) => void; // ✅ Added
  onError: (message: string) => void; // ✅ Added
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
}) => {
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>(
    'manufacturer'
  );
  const [nNumber, setNNumber] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelOptions = React.useMemo(() => {
    return Array.from(modelCounts.entries()).map(([model, count]) => ({
      name: model,
      count,
    }));
  }, [modelCounts]);

  const onManufacturerSelect = (manufacturer: string | null) => {
    setSelectedManufacturer(manufacturer); // ✅ Now accepts both string and null
  };

  async function fetchAircraftByNNumber(
    nNumber: string
  ): Promise<Aircraft | null> {
    try {
      const response = await fetch(`/api/aircraft?nNumber=${nNumber}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      return data as Aircraft;
    } catch (error) {
      console.error('Error fetching aircraft by N-Number:', error);
      return null;
    }
  }

  // Reset manufacturer selection
  const resetManufacturerSelection = () => {
    console.log('Resetting manufacturer selection...');
    if (abortControllerRef.current) {
      console.log('Aborting ongoing fetch request during reset...');
      abortControllerRef.current.abort();
    }
    setSelectedManufacturer('');
    setSelectedModel('');
    setModels([]);
  };

  return (
    <>
      {!isMinimized ? (
        <div className="bg-white rounded-lg shadow-lg p-4 w-[320px] absolute top-4 left-4 z-[3000]">
          {/* Header Section */}
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

          {/* Search Mode Toggle */}
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

          {/* Search Components */}
          {searchMode === 'manufacturer' ? (
            <>
              <ManufacturerSelector
                manufacturers={manufacturers.map((m) => m.label)} // ✅ Convert SelectOption[] to string[]
                selectedManufacturer={selectedManufacturer}
                setSelectedManufacturer={setSelectedManufacturer}
                onSelect={onManufacturerSelect}
              />

              {selectedManufacturer && models.length > 0 && (
                <ModelSelector
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  selectedManufacturer={selectedManufacturer}
                  models={models}
                  totalActive={totalActive}
                  onModelUpdate={onModelSelect}
                />
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
