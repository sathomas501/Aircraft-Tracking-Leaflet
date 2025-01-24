// components/aircraft/selector/UnifiedSelector.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, X, Search, Plane } from 'lucide-react';
import type { Aircraft, SelectOption } from '@/types/base';

interface UnifiedSelectorProps {
  selectedType: string;
  onManufacturerSelect: (manufacturer: string) => Promise<void>;
  onModelSelect: (model: string) => void;
  selectedManufacturer: string;
  selectedModel: string;
  onAircraftUpdate: React.Dispatch<React.SetStateAction<Aircraft[]>>;
  modelCounts?: Map<string, number>;
  totalActive?: number;
}

interface AircraftCache {
  [manufacturer: string]: {
      models: any[]; // Replace with the correct model type
      positions: any[]; // Replace with the correct position type
  };
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  onManufacturerSelect,
  onModelSelect,
  selectedModel,
  onAircraftUpdate,
  modelCounts = new Map(),
  totalActive = 0
}) => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>('manufacturer');
  const [nNumber, setNNumber] = useState('');
  const [activeAircraftCache, setActiveAircraftCache] = useState<AircraftCache>({});
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null); // AbortController reference
  
  // Filter manufacturers
  const filteredManufacturers = useMemo(() => {
    if (!searchTerm) return manufacturers; // Show all if no search term
    
    return manufacturers
        .filter(manufacturer => 
            manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase().trim())
        )
        .sort((a, b) => a.label.localeCompare(b.label));
}, [manufacturers, searchTerm]);

  const handleManufacturerSelect = async (selectedMfr: string) => {
    try {
        console.log('Selected Manufacturer:', selectedMfr);
        setLoading(true);
        setError(null);
        setSearchTerm(selectedMfr); // Set the search term to selected manufacturer
        setIsManufacturerOpen(false); // Close the dropdown
        setSelectedManufacturer(selectedMfr); // Update selected manufacturer

        // Check if data is already cached
        if (activeAircraftCache[selectedMfr]) {
            const cachedData = activeAircraftCache[selectedMfr];
            console.log('Using Cached Data:', cachedData);
            setModels(cachedData.models || []);
            onAircraftUpdate(cachedData.positions || []);
            return;
        }

        // Fetch active aircraft from the server
        const payload = { manufacturer: selectedMfr };
        console.log('Request Payload:', payload);

        const response = await fetch(`/api/aircraft/track-manufacturer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Error Response from Server:', data);
            throw new Error(data.message || 'Failed to fetch aircraft data.');
        }

        console.log('Server Response:', data);

        // Update the cache with active aircraft data
        setActiveAircraftCache((prev) => ({
            ...prev,
            [selectedMfr]: {
                models: data.models || [],
                positions: data.positions || [],
            },
        }));

        // Update the dropdown and state
        setModels(data.models || []);
        onAircraftUpdate(data.positions || []);
      } catch (err) {
        console.error('Error selecting manufacturer:', err);
        if (err instanceof Error) {
            setError(err.message || 'An unexpected error occurred.');
        } else {
            setError('An unexpected error occurred.');
        }
    } finally {
        setLoading(false);
    }
};

  // Fetch manufacturers
  const fetchManufacturers = useCallback(async () => {
    try {
      console.log('[Selector] Starting manufacturers fetch');
      setLoading(true);
      setError(null);
     
      const response = await fetch('/api/manufacturers');
      console.log('[Selector] Response status:', response.status);
      
      const data = await response.json();
      console.log('[Selector] Response data:', data);
      
      if (!data.manufacturers) {
        throw new Error('No manufacturers data received');
      }
  
      // Sort manufacturers alphabetically by label
      const sortedManufacturers = data.manufacturers.sort((a: SelectOption, b: SelectOption) => 
        a.label.localeCompare(b.label)
      );
  
      setManufacturers(sortedManufacturers);
    } catch (err) {
      console.error('Error fetching manufacturers:', err);
      setError('Failed to load manufacturers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

// Use effect for initial load
useEffect(() => {
  fetchManufacturers();
}, [fetchManufacturers]);


// Reset manufacturer selection
const resetManufacturerSelection = () => {
  console.log('Resetting manufacturer selection...');

  if (abortControllerRef.current) {
      console.log('Aborting ongoing fetch request during reset...');
      abortControllerRef.current.abort(); // Cancel ongoing fetch
  }

  setSelectedManufacturer(''); // Clear the selected manufacturer
  setSearchTerm(''); // Clear the search term
  setModels([]); // Clear the models
  setError(null); // Clear error messages
  onAircraftUpdate([]); // Clear aircraft data
  setIsManufacturerOpen(false); // Close the dropdown
  onModelSelect(''); // Reset model selection if you have this function
};


// Fetch models when manufacturer changes
const fetchModels = async (selectedManufacturer: string) => {
  if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Cancel any ongoing requests
  }

  const controller = new AbortController();
  abortControllerRef.current = controller; // Store the new controller

  try {
      setLoading(true);
      setError(null);

      const payload = { manufacturer: selectedManufacturer };
      console.log('Request payload for /api/aircraft/track-manufacturer:', payload);

      const response = await fetch(`/api/aircraft/track-manufacturer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal, // Pass the abort signal
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
          const errorData = await response.json();
          console.error('Server responded with an error:', errorData);
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch models`);
      }

      const data = await response.json();
      console.log('Fetched models data:', data);

      setModels(data.models || []);
      onAircraftUpdate(data.positions || []);
  } catch (error) {
      if (controller.signal.aborted) {
          console.log('Fetch aborted: Request was canceled.');
          return;
      }
      if (error instanceof Error) {
          console.error('Error fetching models:', error.message);
          setError(error.message);
      } else {
          console.error('Unknown error occurred while fetching models:', error);
          setError('An unexpected error occurred.');
      }
  } finally {
      setLoading(false);
      abortControllerRef.current = null; // Reset the controller after completion
  }
};

useEffect(() => {
  if (!selectedManufacturer) {
      console.log('No manufacturer selected. Clearing models...');
      setModels([]);
      return;
  }

  console.log('Fetching models for manufacturer:', selectedManufacturer);
  fetchModels(selectedManufacturer);

  return () => {
      if (abortControllerRef.current) {
          console.log('Aborting fetch request...');
          abortControllerRef.current.abort(); // Abort any ongoing requests
      }
  };
}, [selectedManufacturer, onAircraftUpdate]);
;

// Handle N-Number search
const handleNNumberSearch = async () => {
  if (!nNumber) return;

  try {
    setLoading(true);
    setError(null);
    
    const response = await fetch(`/api/aircraft/n-number/${encodeURIComponent(nNumber)}`);
    
    if (!response.ok) {
      throw new Error(`Aircraft not found`);
    }

    const data = await response.json();
    onAircraftUpdate([data]); // Update with the found aircraft
  } catch (err) {
    console.error('Error searching N-Number:', err);
    setError('Aircraft not found or invalid N-Number');
  } finally {
    setLoading(false);
  }
};

const handleReset = () => {
  setError(null);
  setModels([]);
  onAircraftUpdate([]);
  setSelectedManufacturer(''); // Reset the selected manufacturer
};

return (
  <div className="bg-white rounded-lg shadow-lg p-4">
    {/* Reset Button */}
    <div className="flex justify-end mb-4">
      <button
        onClick={resetManufacturerSelection}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Reset
      </button>
    </div>

    {error && (
      <div className="text-black text-sm py-2 bg-red-50 px-3 rounded flex justify-between items-center">
        <span>{error}</span>
      </div>
    )}

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

    {loading && (
      <div className="text-gray-600 text-sm py-2 animate-pulse">
        Loading...
      </div>
    )}
    
    {!loading && !error && (
      <div className="space-y-4">
        {searchMode === 'manufacturer' ? (
          <>
            {/* Manufacturer Combobox */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600">
                Manufacturer
              </label>
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      const newTerm = e.target.value;
                      setSearchTerm(newTerm);
                      setSelectedManufacturer('');
                      setIsManufacturerOpen(true);
                    }}
                    onFocus={() => setIsManufacturerOpen(true)}
                    placeholder="Search or select manufacturer..."
                    className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm
                             focus:ring-blue-500 focus:border-blue-500
                             bg-white text-gray-900"
                  />
                  <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                </div>

                {/* Manufacturer Dropdown */}
                {isManufacturerOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredManufacturers.map((manufacturer) => (
                      <button
                        key={manufacturer.value}
                        onClick={() => {
                          handleManufacturerSelect(manufacturer.value);
                          setSearchTerm(manufacturer.label);
                          setIsManufacturerOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                      >
                        <div className="flex justify-between items-center">
                          <span>{manufacturer.label}</span>
                          <span className="text-sm text-gray-500">
                            {manufacturer.activeCount && manufacturer.activeCount > 0
                              ? `${manufacturer.activeCount.toLocaleString()} active / ${manufacturer.count?.toLocaleString()} total`
                              : `${manufacturer.count?.toLocaleString()} total`}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Model Dropdown */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600">
                Model
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => onModelSelect(e.target.value)}
                  className="w-full p-2 pr-8 border border-gray-300 rounded-md shadow-sm 
                           focus:ring-blue-500 focus:border-blue-500 
                           bg-white text-gray-900 appearance-none
                           disabled:bg-gray-100 disabled:text-gray-500"
                  disabled={!selectedManufacturer}
                >
                  <option value="">
                    {selectedManufacturer
                      ? `All Models (${totalActive} active)`
                      : 'Select a manufacturer first'}
                  </option>
                  {models.map((model) => {
                    const activeCount = model.activeCount || 0;
                    return (
                      <option key={model.value} value={model.value}>
                        {model.label} ({activeCount} active / {model.count?.toLocaleString() || 0} total)
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-2 top-3 text-gray-500" size={16} />
              </div>
            </div>
          </>
        ) : (
          /* N-Number Search */
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-600">
              N-Number
            </label>
            <div className="relative">
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={nNumber}
                    onChange={(e) => setNNumber(e.target.value.toUpperCase())}
                    placeholder="Enter N-Number..."
                    className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm
                             focus:ring-blue-500 focus:border-blue-500
                             bg-white text-gray-900"
                    maxLength={6}
                  />
                  <Plane className="absolute left-2 top-2.5 text-gray-400" size={16} />
                </div>
                <button
                  onClick={handleNNumberSearch}
                  disabled={!nNumber}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md
                           hover:bg-blue-600 focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:ring-offset-2
                           disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Search
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Enter the N-Number without the 'N' prefix (e.g., '12345' for N12345)
            </p>
          </div>
        )}
      </div>
    )}
  </div>
);
}

export default UnifiedSelector;