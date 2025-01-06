import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTypeAwareManufacturers, useAircraftModels } from '@/hooks/useAircraftData';
import { List, Loader } from 'lucide-react';
import type { AircraftOption } from '@/types/types';
import debounce from 'lodash/debounce';
import { useOpenskyPositions } from '@/hooks/useOpenskyPositions'; // Updated import

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
  // Local state
  const [manufacturerInput, setManufacturerInput] = useState(selectedManufacturer || '');
  const [selectedManufacturerValue, setSelectedManufacturerValue] = useState(selectedManufacturer || '');
  const [localSelectedModel, setLocalSelectedModel] = useState(selectedModel || '');
  const [localNNumber, setLocalNNumber] = useState(nNumber);
  const [manufacturerOptions, setManufacturerOptions] = useState<AircraftOption[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<AircraftOption[]>([]);
  const [isManufacturerFocused, setIsManufacturerFocused] = useState(false);
  const [isFullListOpen, setIsFullListOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs
  const manufacturerInputRef = useRef<HTMLInputElement>(null);
  const manufacturerOptionsRef = useRef<HTMLDivElement>(null);
  const manufacturerContainerRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const { 
    data: manufacturers = [], 
    isLoading: isLoadingManufacturers,
    error: manufacturersError 
  } = useTypeAwareManufacturers(selectedType);

  const { 
    data: models = [], 
    isLoading: isLoadingModels 
  } = useAircraftModels(selectedManufacturerValue || '', selectedType);


  // Get OpenSky positions for the selected manufacturer
  const {
    positions,
    isLoading: isLoadingPositions,
    error: positionsError
  } = useOpenskyPositions(selectedManufacturerValue);

 // Get active status for a model
 const getModelStatus = useCallback((model: AircraftOption) => {
  const position = positions[model.value];
  console.log(`Checking status for model ${model.value}:`, position);
  
  if (!position) {
    console.log(`No position data for ${model.value}`);
    return '';
  }

  if (!position.last_contact) {
    console.log(`No last_contact for ${model.value}`);
    return '';
  }

  const timeSinceLastContact = Date.now() / 1000 - position.last_contact;
  console.log(`Time since last contact for ${model.value}:`, timeSinceLastContact);

  if (timeSinceLastContact > 3600) {
    console.log(`${model.value} not active (last seen ${Math.round(timeSinceLastContact / 60)} minutes ago)`);
    return '';
  }

  const status = position.on_ground 
    ? ' (On Ground)' 
    : ' (In Flight - ' + 
      (position.altitude ? `${Math.round(position.altitude)}ft` : 'Unknown alt.') +
      (position.heading ? ` ${Math.round(position.heading)}°` : '') +
      ')';
    
  console.log(`${model.value} status:`, status);
  return status;
}, [positions]);

// Count active aircraft
const activeCount = useMemo(() => {
  return models.reduce((count, model) => {
    const status = getModelStatus(model);
    return count + (status ? 1 : 0);
  }, 0);
}, [models, getModelStatus]);



  // Create debounced filter function
  const debouncedFilter = useCallback(
    debounce((searchTerm: string, options: AircraftOption[]) => {
      const filtered = !searchTerm 
        ? options 
        : options.filter(option => 
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
          );
      setFilteredOptions(filtered);
    }, 3000), // 3 second debounce
    []
  );

  // Update manufacturer options when manufacturers data changes
  useEffect(() => {
    if (manufacturers.length > 0) {
      const sortedManufacturers = [...manufacturers].sort((a, b) => 
        a.label.localeCompare(b.label)
      );
      setManufacturerOptions(sortedManufacturers);
      setFilteredOptions(sortedManufacturers);
    }
  }, [manufacturers]);

  // Update filtering when input or options change
  useEffect(() => {
    debouncedFilter(manufacturerInput, manufacturerOptions);
    return () => {
      debouncedFilter.cancel();
    };
  }, [manufacturerInput, manufacturerOptions, debouncedFilter]);

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        manufacturerContainerRef.current && 
        !manufacturerContainerRef.current.contains(event.target as Node)
      ) {
        setIsManufacturerFocused(false);
        setIsFullListOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const displayedOptions = filteredOptions;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < displayedOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && displayedOptions[highlightedIndex]) {
          handleManufacturerSelect(displayedOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsManufacturerFocused(false);
        setIsFullListOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [filteredOptions, highlightedIndex]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && manufacturerOptionsRef.current) {
      const option = manufacturerOptionsRef.current.children[highlightedIndex] as HTMLElement;
      if (option) {
        option.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Handlers
  const handleManufacturerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManufacturerInput(value);
    setIsManufacturerFocused(true);
    setHighlightedIndex(-1);
  };

  const handleManufacturerSelect = (manufacturer: AircraftOption) => {
    setSelectedManufacturerValue(manufacturer.value);
    setManufacturerInput(manufacturer.label);
    setIsManufacturerFocused(false);
    setIsFullListOpen(false);
    setHighlightedIndex(-1);
    onManufacturerSelect(manufacturer.value);
  };

  const handleModelSelect = (model: AircraftOption) => {
    setLocalSelectedModel(model.value);
    onModelSelect(model.value);
  };

  const handleNNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (/^[A-Z0-9]*$/.test(value)) {
      setLocalNNumber(value);
      onNNumberChange(value);
    }
  };

  const toggleFullList = () => {
    setIsFullListOpen(!isFullListOpen);
    setIsManufacturerFocused(true);
    setHighlightedIndex(-1);
  };

  return (
    <div className="flex flex-col gap-4" ref={manufacturerContainerRef}>
      {/* Manufacturer Input */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={manufacturerInputRef}
              type="text"
              value={manufacturerInput}
              onChange={handleManufacturerInputChange}
              onFocus={() => setIsManufacturerFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search manufacturers..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isLoadingManufacturers && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
          <button
            onClick={toggleFullList}
            className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none"
            aria-label="Show all manufacturers"
          >
            <List size={20} />
          </button>
        </div>

        {/* Manufacturer Options */}
        {(isManufacturerFocused || isFullListOpen) && (
          <div
            ref={manufacturerOptionsRef}
            className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {isLoadingManufacturers ? (
              <div className="p-4 text-center text-gray-500">
                <Loader className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading manufacturers...
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((manufacturer, index) => (
                <div
                  key={manufacturer.value}
                  onClick={() => handleManufacturerSelect(manufacturer)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{manufacturer.label}</div>
                  {manufacturer.count && (
                    <div className="text-sm text-gray-500">
                      {manufacturer.count} aircraft
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                No manufacturers found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model Select - Show all models with active status */}
      {selectedManufacturerValue && (
        <div className="relative">
          <select
            value={localSelectedModel}
            onChange={(e) => handleModelSelect({ value: e.target.value, label: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            disabled={isLoadingModels || isLoadingPositions}
          >
            <option value="">All Models ({models.length}) - {activeCount} Active</option>
            {models.map((model) => {
              const status = getModelStatus(model);
              return (
                <option key={model.value} value={model.value}>
                  {model.label}{status}{model.count ? ` (${model.count})` : ''}
                </option>
              );
            })}
          </select>
          {(isLoadingModels || isLoadingPositions) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {(manufacturersError || positionsError) && (
        <div className="text-red-500 text-sm">
          {manufacturersError?.toString() || positionsError?.toString()}
        </div>
      )}

      {/* N-Number Input */}
      <input
        type="text"
        value={localNNumber}
        onChange={handleNNumberChange}
        placeholder="N-Number (optional)"
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        maxLength={6}
      />
    </div>
  );
};

export { CompactManufacturerSelector as UnifiedSelector };

