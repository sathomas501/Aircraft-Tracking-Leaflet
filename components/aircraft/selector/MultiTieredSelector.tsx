import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTypeAwareManufacturers, useAircraftModels } from '@/hooks/useAircraftData';
import { List } from 'lucide-react';

interface CompactManufacturerSelectorProps {
  selectedType?: string;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onNNumberChange?: (nNumber: string) => void;
  selectedManufacturer?: string;
  selectedModel?: string;
  nNumber?: string;
}

export const CompactManufacturerSelector: React.FC<CompactManufacturerSelectorProps> = ({
  selectedType,
  onManufacturerSelect,
  onModelSelect,
  onNNumberChange = () => {}, 
  selectedManufacturer,
  selectedModel,
  nNumber = ''
}) => {
  const [manufacturerInput, setManufacturerInput] = useState(selectedManufacturer || '');
  const [selectedManufacturerValue, setSelectedManufacturerValue] = useState(selectedManufacturer || '');
  const [localSelectedModel, setLocalSelectedModel] = useState(selectedModel || '');
  const [localNNumber, setLocalNNumber] = useState(nNumber);
  const [manufacturerOptions, setManufacturerOptions] = useState<any[]>([]);
  const [isManufacturerFocused, setIsManufacturerFocused] = useState(false);
  const [isFullListOpen, setIsFullListOpen] = useState(false);

  const manufacturerInputRef = useRef<HTMLInputElement>(null);
  const manufacturerOptionsRef = useRef<HTMLDivElement>(null);
  const manufacturerContainerRef = useRef<HTMLDivElement>(null);

  const { 
    data: manufacturers = [], 
    isLoading: isLoadingManufacturers,
    error: manufacturersError 
  } = useTypeAwareManufacturers(selectedType);

  const { 
    data: models = [], 
    isLoading: isLoadingModels 
  } = useAircraftModels(selectedManufacturerValue || '', selectedType);

  // Group manufacturers alphabetically
  const groupedManufacturers = manufacturers.reduce((acc, manufacturer) => {
    const firstLetter = manufacturer.label[0].toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(manufacturer);
    return acc;
  }, {} as Record<string, any[]>);

  // Sort models alphabetically
  const sortedModels = [...models].sort((a, b) => a.label.localeCompare(b.label));

  // Filter manufacturers based on input
  useEffect(() => {
    if (manufacturerInput) {
      // Clear full list when typing
      if (isFullListOpen) {
        setIsFullListOpen(false);
      }

      const filtered = manufacturers.filter(m => 
        m.label.toLowerCase().includes(manufacturerInput.toLowerCase())
      );
      setManufacturerOptions(filtered);
      setIsManufacturerFocused(true);
    } else {
      setManufacturerOptions([]);
      setIsManufacturerFocused(false);
    }
  }, [manufacturerInput, manufacturers, isFullListOpen]);

  // Handle manufacturer input change
  const handleManufacturerInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setManufacturerInput(value);
    
    // Reset selected manufacturer if input changes
    if (value !== selectedManufacturerValue) {
      setSelectedManufacturerValue('');
      onManufacturerSelect('');
      setLocalSelectedModel('');
      onModelSelect('');
    }
  }, [onManufacturerSelect, onModelSelect, selectedManufacturerValue]);

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback((manufacturer: string) => {
    setManufacturerInput(manufacturer);
    setSelectedManufacturerValue(manufacturer);
    onManufacturerSelect(manufacturer);
    setManufacturerOptions([]);
    setIsManufacturerFocused(false);
    setIsFullListOpen(false);
    
    // Reset model
    setLocalSelectedModel('');
    onModelSelect('');
  }, [onManufacturerSelect, onModelSelect]);

  // Handle full list button click
  const handleFullListClick = useCallback(() => {
    setIsFullListOpen(!isFullListOpen);
    
    // Clear selected manufacturer and model when full list is opened
    if (!isFullListOpen) {
      setManufacturerInput('');
      setSelectedManufacturerValue('');
      onManufacturerSelect('');
      setLocalSelectedModel('');
      onModelSelect('');
    }
  }, [isFullListOpen, onManufacturerSelect, onModelSelect]);

  // Handle model selection
  const handleModelSelect = useCallback((model: string) => {
    setLocalSelectedModel(model);
    onModelSelect(model);
  }, [onModelSelect]);

  // Handle N-Number change
  const handleNNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value === '' || (value.startsWith('N') && value.length <= 6)) {
      setLocalNNumber(value);
      onNNumberChange(value);
    }
  }, [onNNumberChange]);

  return (
    <div className="flex items-center space-x-4 relative">
      {/* Manufacturer Container */}
      <div ref={manufacturerContainerRef} className="relative w-1/4">
        <div className="flex items-center space-x-2">
          <div className="flex-grow relative">
            <input
              ref={manufacturerInputRef}
              type="text"
              value={manufacturerInput}
              onChange={handleManufacturerInputChange}
              onFocus={() => {
                if (manufacturerInput) {
                  setIsManufacturerFocused(true);
                }
              }}
              placeholder="Enter Manufacturer"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isManufacturerFocused && manufacturerOptions.length > 0 && (
              <div 
                ref={manufacturerOptionsRef}
                className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto"
              >
                {manufacturerOptions.map(manufacturer => (
                  <div
                    key={manufacturer.value}
                    className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                    onClick={() => handleManufacturerSelect(manufacturer.value)}
                  >
                    {manufacturer.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Full List Button */}
          <button 
            onClick={handleFullListClick}
            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            title="View All Manufacturers"
          >
            <List size={20} />
          </button>
        </div>

        {/* Full Manufacturer List */}
        {isFullListOpen && (
          <div className="absolute z-20 w-full bg-white border rounded-md shadow-lg mt-2 max-h-96 overflow-y-auto">
            {Object.entries(groupedManufacturers)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([letter, manufacturerGroup]) => (
                <div key={letter} className="border-b last:border-b-0">
                  <div className="px-4 py-2 bg-blue-50 text-xs font-semibold text-blue-800">
                    {letter}
                  </div>
                  {manufacturerGroup.map(manufacturer => (
                    <div
                      key={manufacturer.value}
                      className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                      onClick={() => handleManufacturerSelect(manufacturer.value)}
                    >
                      {manufacturer.label}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}

        {/* Model Dropdown - Positioned relative to manufacturer input */}
        {selectedManufacturerValue && sortedModels.length > 0 && (
          <div className="absolute left-0 top-full mt-2 w-full z-20">
            <div className="bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {sortedModels.map(model => (
                <div
                  key={model.value}
                  className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                  onClick={() => handleModelSelect(model.value)}
                >
                  {model.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* N-Number Input */}
      <div className="w-24">
        <input
          type="text"
          value={localNNumber}
          onChange={handleNNumberChange}
          placeholder="N-Number"
          maxLength={6}
          className="w-full px-2 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default CompactManufacturerSelector;