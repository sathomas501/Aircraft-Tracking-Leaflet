import React, { useState } from 'react';
import MinimizeToggle from './MinimizeToggle';
import AircraftStats from './AircraftStats';
import ManufacturerSelector from './ManufacturerSelector';
import ModelSelector from './ModelSelector';
import { Aircraft } from '@/types/base';

type UnifiedSelectorProps = {
  selectedType: string; // Properly closed type definition
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedModel: React.Dispatch<React.SetStateAction<string>>;
  modelCounts: Map<string, number>;
  totalActive: number;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (updatedAircraft: Aircraft[]) => void;
  updateModelCounts: () => void;
  onReset: () => void;
};

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedType,
  selectedManufacturer,
  selectedModel,
  setSelectedModel,
  modelCounts,
  totalActive,
  onManufacturerSelect,
  onModelSelect,
  onAircraftUpdate,
  updateModelCounts,
  onReset
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg w-[350px]">
      <MinimizeToggle isMinimized={isMinimized} onToggle={() => setIsMinimized(!isMinimized)} />
      {!isMinimized && (
        <>
          <AircraftStats 
            manufacturer={selectedManufacturer}
            selectedType={selectedType}
            model={selectedModel}
            totalActive={totalActive}  
          />
          <ManufacturerSelector 
            selectedManufacturer={selectedManufacturer}
            onSelect={onManufacturerSelect}
            manufacturers={[]} // Add the appropriate manufacturers array here
          />
          <ModelSelector 
            selectedModel={selectedModel}
            selectedManufacturer={selectedManufacturer}
            modelCounts={modelCounts}
            onSelect={onModelSelect}
          />
        </>
      )}
    </div>
  );
};

export default UnifiedSelector;