import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { SelectOption } from '@/types/base';
import { Search, ChevronDown, Plane } from 'lucide-react';

export interface UnifiedSelectorProps {
  selectedType: string;
  selectedManufacturer: string;
  selectedModel: string;
  modelCounts: Map<string, number>;
  totalActive: number;
  onManufacturerSelect: (manufacturer: string) => Promise<void>;
  onModelSelect: React.Dispatch<React.SetStateAction<string>>;
  onAircraftUpdate: React.Dispatch<any>;
}

interface ManufacturerData {
  name: string;
  count: number;
  activeCount?: number;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedType,
  selectedManufacturer: propSelectedManufacturer,
  selectedModel,
  onManufacturerSelect,
  onModelSelect,
  onAircraftUpdate,
  modelCounts = new Map(),
  totalActive = 0,
}) => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchManufacturers = useCallback(async () => {
    console.log('Fetching manufacturers...'); // Debug log
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/manufacturers', { signal: controller.signal });
      console.log('Response status:', response.status); // Debug log
      
      if (!response.ok) {
        throw new Error('Failed to fetch manufacturers.');
      }

      const data = await response.json();
      console.log('Manufacturers data received:', data); // Debug log

      if (!data.manufacturers?.length) {
        throw new Error('No manufacturers data received.');
      }

      setManufacturers(data.manufacturers);
      
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Manufacturer fetch error:', err);
        setError('Failed to load aircraft data.');
        setManufacturers([]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Call fetchManufacturers when component mounts
  useEffect(() => {
    console.log('Component mounted, fetching manufacturers...'); // Debug log
    fetchManufacturers();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchManufacturers]);

  // Debug useEffect to monitor state changes
  useEffect(() => {
    console.log('Manufacturers state updated:', manufacturers);
  }, [manufacturers]);

  // Filter manufacturers based on search term
  const filteredManufacturers = useMemo(() => {
    console.log('Filtering manufacturers with search term:', searchTerm); // Debug log
    if (!searchTerm) return manufacturers;
    return manufacturers.filter((manufacturer) =>
      manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [manufacturers, searchTerm]);

  // Models showing either static or active counts based on selection
  const modelOptions = useMemo(() => {
    if (!propSelectedManufacturer) {
      // Show static counts before manufacturer selection
      return models.map(model => ({
        ...model,
        label: `${model.value} (${model.count} registered)`
      }));
    } else {
      // Show active counts after manufacturer selection
      return models.map(model => ({
        ...model,
        label: `${model.value} (${modelCounts.get(model.value) || 0} active)`
      }));
    }
  }, [models, modelCounts, propSelectedManufacturer]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm ml-4 text-sm">
      {/* Manufacturer Search/Select */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600">
          Manufacturer
        </label>
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
            className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
          />
          <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
        </div>

        {/* Manufacturer Dropdown */}
        {isManufacturerOpen && filteredManufacturers.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredManufacturers.map((manufacturer) => (
              <button
                key={manufacturer.value}
                onClick={() => {
                  onManufacturerSelect(manufacturer.value);
                  setIsManufacturerOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
              >
                <div className="flex justify-between items-center">
                  <span>{manufacturer.value}</span>
                  <span className="text-xs text-gray-500">
                    {manufacturer.count} registered
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model Select */}
      <div className="space-y-2 mt-4">
        <label className="block text-sm font-medium text-gray-600">
          Model
        </label>
        <div className="relative">
          <select
            value={selectedModel}
            onChange={(e) => onModelSelect(e.target.value)}
            className="w-full p-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 appearance-none disabled:bg-gray-100 disabled:text-gray-500"
            disabled={!propSelectedManufacturer}
          >
            <option value="">
              {propSelectedManufacturer
                ? `All Models (${totalActive} active)`
                : 'Select a manufacturer first'}
            </option>
            {modelOptions.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-3 text-gray-500" size={16} />
        </div>
      </div>

      {/* Loading and Error States */}
      {loading && (
        <div className="text-gray-600 text-sm py-2 animate-pulse">
          Loading...
        </div>
      )}
      {error && (
        <div className="text-red-600 text-sm py-2">
          {error}
        </div>
      )}
    </div>
  );
};

export default React.memo(UnifiedSelector);