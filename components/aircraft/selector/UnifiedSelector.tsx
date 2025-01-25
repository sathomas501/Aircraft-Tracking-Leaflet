import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
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
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>('manufacturer');
  const [nNumber, setNNumber] = useState('');
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetManufacturerSelection = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSearchTerm('');
    setModels([]);
    setError(null);
    onAircraftUpdate([]);
  };

  const filteredManufacturers = useMemo(() => {
    if (!searchTerm) return manufacturers;
    return manufacturers.filter((manufacturer) =>
      manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [manufacturers, searchTerm]);

  const fetchModels = async (selectedManufacturer: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/aircraft/track-manufacturer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer: selectedManufacturer }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch models`);
      }

      const data = await response.json();
      setModels(data.models || []);
      onAircraftUpdate(data.positions || []);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

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
      onAircraftUpdate([data]);
    } catch (err) {
      setError('Aircraft not found or invalid N-Number');
    } finally {
      setLoading(false);
    }
  };

  const fetchManufacturers = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/manufacturers', { signal: controller.signal });
      if (!response.ok) {
        throw new Error('Failed to fetch manufacturers.');
      }

      const data = await response.json();
      if (!data.manufacturers?.length) {
        throw new Error('No manufacturers data received.');
      }

      setManufacturers(
        data.manufacturers.map((m: ManufacturerData) => ({
          value: m.name,
          label: m.name,
          count: m.count,
          activeCount: m.activeCount
        }))
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        setError('Unable to load manufacturers.');
        setManufacturers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManufacturers();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchManufacturers]);

  useEffect(() => {
    if (!propSelectedManufacturer) {
      setModels([]);
      return;
    }
    fetchModels(propSelectedManufacturer);
  }, [propSelectedManufacturer, onAircraftUpdate]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm ml-4 text-sm">
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

      <div className="flex space-x-2 mb-3">
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
                          <span>{manufacturer.label}</span>
                          <span className="text-xs text-gray-500">
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

              <div className="space-y-2">
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
                    {models.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label} ({model.activeCount || 0} active / {model.count?.toLocaleString() || 0} total)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-3 text-gray-500" size={16} />
                </div>
              </div>
            </>
          ) : (
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
                      className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                      maxLength={6}
                    />
                    <Plane className="absolute left-2 top-2.5 text-gray-400" size={16} />
                  </div>
                  <button
                    onClick={handleNNumberSearch}
                    disabled={!nNumber}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
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

export default React.memo(UnifiedSelector);