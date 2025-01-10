import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import type { SelectOption } from '@/types/base';
import type { Aircraft } from '@/types/base';

interface UnifiedSelectorProps {
  selectedType: string;
  onManufacturerSelect: (manufacturer: string) => Promise<void>;
  onModelSelect: (model: string) => void;
  selectedManufacturer: string;
  selectedModel: string;
  onAircraftUpdate: React.Dispatch<React.SetStateAction<Aircraft[]>>;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  onManufacturerSelect,
  onModelSelect,
  selectedManufacturer,
  selectedModel,
  onAircraftUpdate
}) => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);

  // Filter manufacturers
  const filteredManufacturers = useMemo(() => {
    return manufacturers
      .filter(manufacturer => 
        manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [manufacturers, searchTerm]);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/manufacturers');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setManufacturers(data.manufacturers || []);
      } catch (err) {
        console.error('Error fetching manufacturers:', err);
        setError('Failed to load manufacturers');
      } finally {
        setLoading(false);
      }
    };

    fetchManufacturers();
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Aircraft Selector</h2>
        <button
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {loading && (
        <div className="text-gray-600 text-sm py-2 animate-pulse">
          Loading manufacturers...
        </div>
      )}
      
      {error && (
        <div className="text-red-500 text-sm py-2 bg-red-50 px-3 rounded">
          {error}
        </div>
      )}
      
      {!loading && !error && (
        <div className="space-y-4">
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
                      onClick={() => {
                        onManufacturerSelect(manufacturer.value);
                        setSearchTerm(manufacturer.label);
                        setIsManufacturerOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                    >
                      {manufacturer.label} ({manufacturer.count?.toLocaleString() || 0})
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
                onChange={(e) => {
                  onModelSelect(e.target.value);
                }}
                className="w-full p-2 pr-8 border border-gray-300 rounded-md shadow-sm 
                         focus:ring-blue-500 focus:border-blue-500 
                         bg-white text-gray-900 appearance-none
                         disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!selectedManufacturer}
              >
                <option value="">
                  {selectedManufacturer ? 'Select Model' : 'Select a manufacturer first'}
                </option>
                {models.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 text-gray-500" size={16} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedSelector;