// components/aircraft/selector/UnifiedSelector.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, X, Search, Plane } from 'lucide-react';
import type { SelectOption } from '@/types/base';


interface UnifiedSelectorProps {
  selectedType: string;
  onManufacturerSelect: (manufacturer: string) => Promise<void>;
  onModelSelect: (model: string) => void;
  selectedManufacturer: string;
  selectedModel: string;
  onAircraftUpdate: React.Dispatch<any>;
  modelCounts?: Map<string, number>;
  totalActive?: number;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  onManufacturerSelect,
  onModelSelect,
  selectedManufacturer,
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

  // Filter manufacturers
  const filteredManufacturers = useMemo(() => {
    if (!Array.isArray(manufacturers)) return [];  // ✅ Prevents undefined errors
    if (!searchTerm) {
        return manufacturers
            .filter(manufacturer => manufacturer?.label)  // ✅ Ensures all items have a label
            .sort((a, b) => a.label.localeCompare(b.label));  // ✅ Prevents TypeError
    }

    const lowerSearch = searchTerm.toLowerCase();  // ✅ Avoid calling `.toLowerCase()` multiple times

    return manufacturers
        .filter(manufacturer => manufacturer?.label && manufacturer.label.toLowerCase().includes(lowerSearch))
        .sort((a, b) => a.label.localeCompare(b.label));
}, [manufacturers, searchTerm]);  // ✅ Ensures updates only when necessary


  // Fetch manufacturers
const fetchManufacturers = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await fetch('/api/manufacturers');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.manufacturers) {
      throw new Error('No manufacturers data received');
    }

    setManufacturers(data.manufacturers);
  } catch (err) {
    console.error('Error fetching manufacturers:', err);
    setError('Failed to load manufacturers. Please try again.');
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  let isMounted = true;

  fetchManufacturers().then(() => {
      if (!isMounted) return; // ✅ Prevents state updates on unmounted components
  });

  return () => {
      isMounted = false; // ✅ Cleanup function
  };
}, []);


  // Fetch models when manufacturer changes
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedManufacturer) {
        setModels([]);
        return;
      }

      try {
        const response = await fetch(`/api/aircraft/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setModels(data.models || []);
      } catch (err) {
        console.error('Error fetching models:', err);
        setError('Failed to load models');
      }
    };

    fetchModels();
  }, [selectedManufacturer]);

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

  const handleManufacturerSelect = async (selectedMfr: string) => {
    try {
      setLoading(true);
      setError(null);
  
      // Step 1: Update UI state immediately
      await onManufacturerSelect(selectedMfr);
      setSearchTerm(selectedMfr);
      setIsManufacturerOpen(false);
  
      // Step 2: Start tracking process
      console.log("[Frontend] Sending request to track manufacturer:", selectedMfr);

const response = await fetch('/api/aircraft/track-manufacturer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    manufacturer: selectedMfr,
    model: selectedModel // Include selected model if any
  }),
});

console.log("[Frontend] API Response Status:", response.status);

const data = await response.json().catch(() => null);
console.log("[Frontend] API Response Data:", data);
  
      if (!response.ok) {
        if (response.status === 404) {
          setError(data.message || 'No aircraft found for this manufacturer');
          // Still update the manufacturer list to show zero active
          setManufacturers(prev => 
            prev.map(m => 
              m.value === selectedMfr 
                ? { ...m, activeCount: 0 }
                : m
            )
          );
          return;
        }
        throw new Error(data.message || 'Failed to track manufacturer');
      }
  
      // Step 3: Update UI with results
      setManufacturers(prev => 
        prev.map(m => 
          m.value === selectedMfr 
            ? { 
                ...m, 
                activeCount: data.activeCount,
                totalCount: data.totalCount
              }
            : m
        )
      );
  
      // Update aircraft positions if any are active
      if (data.positions && Array.isArray(data.positions)) {
  onAircraftUpdate(data.positions); // Ensure positions is of type Aircraft[]
} else if (data.aircraft && Array.isArray(data.aircraft)) {
  onAircraftUpdate(data.aircraft); // Extract aircraft from an object if necessary
}

  
    } catch (err) {
      console.error('Error selecting manufacturer:', err);
      setError(err instanceof Error ? err.message : 'Failed to select manufacturer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Aircraft Selector</h2>
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} />
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

      {loading && (
        <div className="text-gray-600 text-sm py-2 animate-pulse">
          Loading...
        </div>
      )}
      
      {error && (
        <div className="text-red-500 text-sm py-2 bg-red-50 px-3 rounded">
          {error}
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
                        setSearchTerm(e.target.value);
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

                  {/* Filtered Manufacturer List */}
                  {isManufacturerOpen && filteredManufacturers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredManufacturers.map((manufacturer) => (
                        <button
                          key={manufacturer.value}
                          onClick={() => handleManufacturerSelect(manufacturer.value)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                        >
                          <div className="flex justify-between items-center">
                            <span>{manufacturer.label}</span>
                            <span className="text-sm text-gray-500">
                              {manufacturer.activeCount?.toLocaleString() || 0} active / {manufacturer.count?.toLocaleString() || 0} total
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
                      {selectedManufacturer ? `All Models (${totalActive} active)` : 'Select a manufacturer first'}
                    </option>
                    {models.map((model) => {
                      const activeCount = modelCounts.get(model.value) || 0;
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
};

export default UnifiedSelector;