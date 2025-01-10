import React, { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { SelectOption } from '@/types/base';
import type { Aircraft } from '@/types/base';

interface UnifiedSelectorProps {
  selectedType: string;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  selectedManufacturer: string;
  selectedModel: string;
  onAircraftUpdate?: (aircraft: Aircraft[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  onManufacturerSelect,
  onModelSelect,
  selectedManufacturer,
  selectedModel,
  onAircraftUpdate,
  isOpen,
  onToggle
}) => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching manufacturers...');
        const startTime = Date.now();
        
        const response = await fetch('/api/manufacturers', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log('Manufacturers response:', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          time: Date.now() - startTime + 'ms'
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Manufacturers data:', {
          count: data.manufacturers?.length || 0,
          sample: data.manufacturers?.[0]
        });

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
        console.log('Fetching models for manufacturer:', selectedManufacturer);
        const response = await fetch(`/api/aircraft/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Models data:', data);
        setModels(data.models || []);
      } catch (err) {
        console.error('Error fetching models:', err);
        setError('Failed to load models');
      }
    };

    fetchModels();
  }, [selectedManufacturer]);

  console.log('Render state:', {
    manufacturersCount: manufacturers.length,
    modelsCount: models.length,
    loading,
    error,
    isOpen
  });

  if (!isOpen) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Aircraft Selector</h2>
        <button
          onClick={onToggle}
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
          {/* Manufacturer Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-600">
              Manufacturer
            </label>
            <div className="relative">
              <select
                value={selectedManufacturer}
                onChange={(e) => {
                  console.log('Manufacturer selected:', e.target.value);
                  onManufacturerSelect(e.target.value);
                }}
                className="w-full p-2 pr-8 border border-gray-300 rounded-md shadow-sm 
                         focus:ring-blue-500 focus:border-blue-500 
                         bg-white text-gray-900 appearance-none"
              >
                <option value="">Select Manufacturer</option>
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer.value} value={manufacturer.value}>
                    {manufacturer.label} ({manufacturer.count || 0})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 text-gray-500" size={16} />
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
                  console.log('Model selected:', e.target.value);
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