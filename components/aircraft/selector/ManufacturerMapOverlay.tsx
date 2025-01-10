import React, { useState } from 'react';
import UnifiedSelector from './UnifiedSelector'; // Ensure the path to UnifiedSelector is correct
import { MapWrapper } from '@/components/aircraft/tracking/Map/MapWrapper';

const ManufacturerMapOverlay: React.FC = () => {
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(true);

  const handleManufacturerSelect = (manufacturer: string) => {
    setSelectedManufacturer(manufacturer);
    setSelectedModel(''); // Reset model selection when manufacturer changes
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
  };

  const toggleSelector = () => {
    setIsSelectorOpen((prev) => !prev);
  };

  console.log('Rendering ManufacturerMapOverlay');


  return (
    <div className="relative w-full h-screen">
      {/* Map Component */}
      <MapWrapper />

      {/* Stylish Overlay */}
      <div
        className="absolute top-4 left-4 bg-white p-6 shadow-xl rounded-lg z-50 border border-gray-200"
        style={{ width: '300px', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Aircraft Selector</h2>
        <UnifiedSelector
          selectedType="aircraft" // Replace with the appropriate type
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          isOpen={isSelectorOpen}
          onToggle={toggleSelector}
        />
      </div>

      {/* Info Display */}
      <div
        className="absolute bottom-4 left-4 bg-white p-4 shadow-md rounded-md z-50 border border-gray-200"
        style={{ width: '250px', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
      >
        <p className="text-sm font-semibold text-gray-800">Selected Manufacturer:</p>
        <p className="text-gray-600">{selectedManufacturer || 'None'}</p>
        <p className="text-sm font-semibold text-gray-800 mt-2">Selected Model:</p>
        <p className="text-gray-600">{selectedModel || 'None'}</p>
      </div>
    </div>
  );
};

export default ManufacturerMapOverlay;
