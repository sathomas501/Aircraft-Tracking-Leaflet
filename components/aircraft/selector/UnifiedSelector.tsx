import React, { useState } from 'react';
import { Minus, Search } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import NNumberSelector from './nNumberSelector';
import ModelSelector from './ModelSelector';
import { Aircraft, SelectOption } from '@/types/base';

type UnifiedSelectorProps = {
  selectedType: string;
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedManufacturer: React.Dispatch<React.SetStateAction<string>>;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  modelCounts: Map<string, number>;
  updateModelCounts: () => void;
  totalActive: number;
  manufacturers: SelectOption[];
  onAircraftUpdate: (updatedAircraft: Aircraft[]) => void; // Add this line
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onReset: () => void;
};

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedManufacturer,
  selectedModel,
  setSelectedManufacturer,
  setSelectedModel,
  manufacturers,
  modelCounts,
  onManufacturerSelect,
  onModelSelect,
  onReset,
}) => {
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>(
    'manufacturer'
  );
  const [nNumber, setNNumber] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  // Toggle Minimize
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg px-4 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <Search size={16} />
        <span>Select Aircraft</span>
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg w-[350px] p-4">
      {/* Header with Reset & Minimize Buttons */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <Minus size={20} />
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Reset
          </button>
        </div>
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

      {/* Manufacturer & Model Selection */}
      {searchMode === 'manufacturer' ? (
        <>
          {/* Manufacturer Selector */}
          <ManufacturerSelector
            manufacturers={manufacturers} // ✅ Ensure this is NOT empty
            onSelect={onManufacturerSelect}
            selectedManufacturer={selectedManufacturer}
          />

          {/* Model Selector (Only enabled after manufacturer selection) */}
          <ModelSelector
            selectedModel={selectedModel}
            selectedManufacturer={selectedManufacturer}
            modelCounts={modelCounts}
            onSelect={setSelectedModel}
          />
        </>
      ) : (
        <NNumberSelector
          nNumber={nNumber}
          setNNumber={setNNumber}
          onSearch={() => console.log('Search N-Number:', nNumber)}
        />
      )}
    </div>
  );
};

export default UnifiedSelector;
