import React, { useState } from 'react';
import { Minus, Search } from 'lucide-react';
import ManufacturerSelector from './ManufacturerSelector';
import NNumberSelector from './nNumberSelector';
<<<<<<< Updated upstream
=======
import { fetchAircraftByNNumber } from '../selector/services/aircraftService'; // ✅ Import here
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  onAircraftUpdate: (updatedAircraft: Aircraft[]) => void; // Add this line
=======
  onAircraftUpdate: (updatedAircraft: Aircraft[]) => void;
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
  // Toggle Minimize
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
=======
  const handleNNumberSearch = async (nNumber: string) => {
    try {
      const aircraftData = await fetchAircraftByNNumber(nNumber); // ✅ Call API
      console.log(
        `✈️ Retrieved aircraft for N-Number ${nNumber}:`,
        aircraftData
      );
    } catch (error) {
      console.error('Error fetching aircraft by N-Number:', error);
    }
  };

  // ✅ Prevent unnecessary updates
  const handleManufacturerSelect = (manufacturer: string) => {
    if (manufacturer !== selectedManufacturer) {
      setSelectedManufacturer(manufacturer);
      onManufacturerSelect(manufacturer);
    }
  };

  const restoreState = () => {
    setIsMinimized(false);
    if (!selectedManufacturer) {
      setSearchMode('manufacturer'); // ✅ Restore search mode when reopening
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={restoreState}
>>>>>>> Stashed changes
        className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg px-4 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <Search size={16} />
        <span>Select Aircraft</span>
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg w-[350px] p-4">
<<<<<<< Updated upstream
      {/* Header with Reset & Minimize Buttons */}
=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
      {/* Search Mode Toggle */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setSearchMode('manufacturer')}
          className={`flex-1 py-2 px-4 rounded-md ${
            searchMode === 'manufacturer'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
=======
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setSearchMode('manufacturer')}
          className={`flex-1 py-2 px-4 rounded-md ${searchMode === 'manufacturer' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
>>>>>>> Stashed changes
        >
          By Manufacturer
        </button>
        <button
          onClick={() => setSearchMode('nNumber')}
<<<<<<< Updated upstream
          className={`flex-1 py-2 px-4 rounded-md ${
            searchMode === 'nNumber'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
=======
          className={`flex-1 py-2 px-4 rounded-md ${searchMode === 'nNumber' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
>>>>>>> Stashed changes
        >
          By N-Number
        </button>
      </div>

<<<<<<< Updated upstream
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
=======
      {searchMode === 'manufacturer' ? (
        <>
          <ManufacturerSelector
            onSelect={handleManufacturerSelect}
            selectedManufacturer={selectedManufacturer}
          />

>>>>>>> Stashed changes
          <ModelSelector
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedManufacturer={selectedManufacturer}
            modelCounts={modelCounts}
<<<<<<< Updated upstream
            onSelect={setSelectedModel}
=======
>>>>>>> Stashed changes
          />
        </>
      ) : (
        <NNumberSelector
          nNumber={nNumber}
          setNNumber={setNNumber}
<<<<<<< Updated upstream
          onSearch={() => console.log('Search N-Number:', nNumber)}
=======
          onSearch={handleNNumberSearch}
>>>>>>> Stashed changes
        />
      )}
    </div>
  );
};

export default UnifiedSelector;
