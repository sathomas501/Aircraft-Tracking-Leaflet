import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { SelectOption } from '@/types/base';
import { Search, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchManufacturers = useCallback(async () => {
    console.log('Fetching manufacturers...');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const response = await fetch('/api/manufacturers', { signal: controller.signal });
      console.log('Response received:', response.status);  // Add this
      if (!response.ok) {
          console.error('Response not OK:', await response.text());  // Add this
          throw new Error('Failed to fetch manufacturers.');
      }

      const data = await response.json();
      if (!data.manufacturers?.length) {
        throw new Error('No manufacturers data received.');
      }

      setManufacturers(data.manufacturers);
      toast.success('Manufacturers loaded successfully!');
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Manufacturer fetch error:', err);
        toast.error(
          err instanceof Error ? err.message : 'Failed to load manufacturers data.'
        );
        setManufacturers([]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Call fetchManufacturers when component mounts
  useEffect(() => {
    fetchManufacturers();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchManufacturers]);

  const filteredManufacturers = useMemo(() => {
    if (!searchTerm) return manufacturers;
    return manufacturers.filter((manufacturer) =>
      manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [manufacturers, searchTerm]);

  const modelOptions = useMemo(() => {
    if (!propSelectedManufacturer) {
      return models.map((model) => ({
        ...model,
        label: `${model.value} (${model.count} registered)`,
      }));
    } else {
      return models.map((model) => ({
        ...model,
        label: `${model.value} (${modelCounts.get(model.value) || 0} active)`,
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
                  onManufacturerSelect(manufacturer.value)
                    .then(() => toast.success(`Tracking aircraft for ${manufacturer.value}.`))
                    .catch((err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Error selecting manufacturer.'
                      )
                    );
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
        <label className="block text-sm font-medium text-gray-600">Model</label>
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

      {/* Loading State */}
      {loading && (
        <div className="text-gray-600 text-sm py-2 animate-pulse">Loading...</div>
      )}
    </div>
  );
};

export default React.memo(UnifiedSelector);
