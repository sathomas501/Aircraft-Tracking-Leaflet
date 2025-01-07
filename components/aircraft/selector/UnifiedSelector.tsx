import React, { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash/debounce';
import { List, Loader } from 'lucide-react';
import { useTypeAwareManufacturers, useAircraftModels} from '@/hooks/useAircraftData';
import{fetchOpenskyPositions, fetchOpenskyManufacturers} from 'lib/opensky-client'

interface SelectOption {
  label: string;
  value: string;
  count?: number;
}


interface AircraftOption {
  label: string;
  value: string;
  count?: number;
}
interface ManufacturerOption extends SelectOption {
  count: number;
}

interface ModelOption extends SelectOption {}

const UnifiedSelector = () => {
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      setIsLoading(true);
      try {
        const result = await fetchOpenskyManufacturers();
        const options = result.map((manufacturer: any) => ({
          label: manufacturer.name,
          value: manufacturer.id,
          count: manufacturer.count || 0, // Ensure count is a number
        }));
        setManufacturers(options);
      } catch (error) {
        console.error('Failed to fetch manufacturers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchManufacturers();
  }, []);

  // Fetch positions for selected manufacturer
  const fetchPositions = async () => {
    if (!selectedManufacturer) return;
    setIsLoading(true);
    try {
      const result = await fetchOpenskyPositions([selectedManufacturer]); // Ensure it's an array
      console.log('Positions:', result.positions); // Access 'positions' after resolving the promise
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectManufacturer = (manufacturer: ManufacturerOption) => {
    setSelectedManufacturer(manufacturer.value);
    fetchPositions();
  };

  return (
    <div>
      <h1>Select Aircraft Manufacturer</h1>
      {isLoading && <p>Loading...</p>}
      {!isLoading && (
        <select onChange={(e) => handleSelectManufacturer(manufacturers.find((m) => m.value === e.target.value)!)}>
          <option value="">Select a manufacturer</option>
          {manufacturers.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};


interface CompactManufacturerSelectorProps {
  selectedType?: string;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onNNumberChange?: (nNumber: string) => void;
  selectedManufacturer?: string;
  selectedModel?: string;
  nNumber?: string;
}

const CompactManufacturerSelector: React.FC<CompactManufacturerSelectorProps> = ({
  selectedType,
  onManufacturerSelect,
  onModelSelect,
  onNNumberChange = () => {},
  selectedManufacturer,
  selectedModel,
  nNumber = '',
}) => {
  // States
  const [manufacturerInput, setManufacturerInput] = useState(selectedManufacturer || '');
  const [selectedManufacturerValue, setSelectedManufacturerValue] = useState(selectedManufacturer || '');
  const [localSelectedModel, setLocalSelectedModel] = useState(selectedModel || '');
  const [localNNumber, setLocalNNumber] = useState(nNumber);
  const [filteredOptions, setFilteredOptions] = useState<ManufacturerOption[]>([]);
  const [isManufacturerFocused, setIsManufacturerFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const manufacturerInputRef = useRef<HTMLInputElement>(null);
  const manufacturerOptionsRef = useRef<HTMLDivElement>(null);
  const manufacturerContainerRef = useRef<HTMLDivElement>(null);

  // Data fetching hooks
  const { data: manufacturersData = [], isLoading: isLoadingManufacturers, error: manufacturersError } = useTypeAwareManufacturers(selectedType);
  const { data: modelData = [], isLoading: isLoadingModels } = useAircraftModels(selectedManufacturerValue || '', selectedType);
  const { positions, isLoading: isLoadingPositions, error: positionsError } = fetchOpenskyPositions(selectedManufacturerValue);

  // Handle filtering
  const debouncedFilter = useCallback(
    debounce((searchTerm: string, options: ManufacturerOption[]) => {
      const filtered = !searchTerm
        ? options
        : options.filter((option) => option.label.toLowerCase().includes(searchTerm.toLowerCase()));
      setFilteredOptions(filtered);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedFilter(manufacturerInput, manufacturersData);
    return () => debouncedFilter.cancel();
  }, [manufacturerInput, manufacturersData]);

  useEffect(() => {
    if (manufacturersData?.length > 0) {
      setFilteredOptions(manufacturersData);
    }
  }, [manufacturersData]);

  useEffect(() => {
    if (modelData) {
      setLocalSelectedModel('');
    }
  }, [modelData]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleManufacturerSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsManufacturerFocused(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [filteredOptions, highlightedIndex]
  );

  const handleManufacturerSelect = (manufacturer: ManufacturerOption) => {
    setSelectedManufacturerValue(manufacturer.value);
    setManufacturerInput(manufacturer.label);
    onManufacturerSelect(manufacturer.value);
    setIsManufacturerFocused(false);
    setHighlightedIndex(-1);
  };

  const handleModelSelect = (model: ModelOption) => {
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

  return (
    <div className="flex flex-col gap-4" ref={manufacturerContainerRef}>
      {/* Manufacturer Input */}
      <div className="relative">
        <input
          ref={manufacturerInputRef}
          type="text"
          value={manufacturerInput}
          onChange={(e) => setManufacturerInput(e.target.value)}
          onFocus={() => setIsManufacturerFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search manufacturers..."
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isLoadingManufacturers && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
        {isManufacturerFocused && (
          <div ref={manufacturerOptionsRef} className="absolute z-10 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
            {filteredOptions.map((manufacturer, index) => (
              <div
                key={manufacturer.value}
                onClick={() => handleManufacturerSelect(manufacturer)}
                className={`px-4 py-2 cursor-pointer ${highlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <span>{manufacturer.label}</span>
                {manufacturer.count && <span className="text-sm text-gray-500"> ({manufacturer.count})</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Select */}
      {selectedManufacturerValue && (
        <div>
          <select
            value={localSelectedModel}
            onChange={(e) => handleModelSelect({ value: e.target.value, label: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Models ({modelData.length})</option>
            {modelData.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
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

export { CompactManufacturerSelector };
