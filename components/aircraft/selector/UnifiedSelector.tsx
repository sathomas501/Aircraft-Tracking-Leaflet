import React, { useState, useRef } from 'react';
import { Search, Plus, Minus } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import NNumberSelector from './nNumberSelector';
import ModelSelector from './ModelSelector';
import MinimizeToggle from './MinimizeToggle';
import { Aircraft, SelectOption } from '@/types/base';
import { Model } from '../selector/services/aircraftService';

interface UnifiedSelectorProps {
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedManufacturer: React.Dispatch<React.SetStateAction<string>>;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  manufacturers: SelectOption[];
  modelCounts: Map<string, number>;
  totalActive: number;
  onAircraftUpdate: (updatedAircraft: Aircraft[]) => void;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onReset: () => void;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedManufacturer,
  selectedModel,
  setSelectedManufacturer,
  setSelectedModel,
  manufacturers,
  onManufacturerSelect,
  onModelSelect,
  onReset,
  onAircraftUpdate,
  totalActive,
}) => {
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>(
    'manufacturer'
  );
  const [nNumber, setNNumber] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      {/* Only show the selector when NOT minimized */}
      {!isMinimized && (
        <div className="bg-white rounded-lg shadow-lg p-4 w-[320px] absolute top-4 left-4 z-[3000]">
          {/* Header Section with Minimize Button in Top Left */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              {/* Minimize Toggle - Now Inside UI */}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 bg-gray-200 rounded-md mr-2 hover:bg-gray-300"
              >
                <Minus size={16} />
              </button>
              <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
            </div>

            {/* Reset Button */}
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

          {searchMode === 'manufacturer' ? (
            <>
              <ManufacturerSelector
                manufacturers={manufacturers}
                selectedManufacturer={selectedManufacturer}
                onSelect={onManufacturerSelect}
                onAircraftUpdate={onAircraftUpdate}
                onModelsUpdate={setModels}
              />

              {/* Hide Model Selector Until a Manufacturer is Chosen */}
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
      )}

      {/* Show Plus Button When UI is Minimized */}
      {isMinimized && (
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
