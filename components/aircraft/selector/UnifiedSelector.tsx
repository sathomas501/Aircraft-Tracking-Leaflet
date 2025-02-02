import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plane, X } from 'lucide-react';
import type { SelectOption } from '@/types/base';

interface UnifiedSelectorProps {
  selectedType: string;
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelCounts: Map<string, number>;
  totalActive: number;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (updateData: any) => void;
  onReset: () => void;
}

interface Model {
  model: string;
  count?: number;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedManufacturer,
  selectedModel,
  setSelectedModel,
  modelCounts,
  totalActive,
  onManufacturerSelect,
  onModelSelect,
  onAircraftUpdate,
  onReset
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [nNumber, setNNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [showDropdown, setShowDropdown] = useState(true);
  const [activeCount, setActiveCount] = useState(totalActive);


  // Filter manufacturers
  const filteredManufacturers = useMemo(() => {
    console.log("Filtering manufacturers:", manufacturers.length);
    if (!searchTerm) return manufacturers;
    const search = searchTerm.toLowerCase().trim();
    return manufacturers.filter(m => m.label.toLowerCase().includes(search));
  }, [manufacturers, searchTerm]);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/manufacturers');
        const data = await response.json();
        if (data.manufacturers) {
          setManufacturers(data.manufacturers);
        }
      } catch (err) {
        console.error('Error fetching manufacturers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchManufacturers();
  }, []);

  // Fetch models when manufacturer changes
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedManufacturer) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/aircraft/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`);
        const data = await response.json();
        
        if (data.data) {
          const mappedModels = data.data.map((item: any) => ({
            model: item.model,
            count: modelCounts.get(item.model) || 0
          }));
          setModels(mappedModels);
        }
      } catch (err) {
        console.error('Error fetching models:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [selectedManufacturer, modelCounts]);

  const handleClose = () => {
    setIsVisible(false);
  };

  const handleManufacturerSelect = async (manufacturer: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/aircraft/track-manufacturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      const data = await response.json();
      
      if (data.liveAircraft) {
        const liveCount = data.liveAircraft.length;
        setActiveCount(liveCount);
        onAircraftUpdate(data.liveAircraft);
      }

      onManufacturerSelect(manufacturer);
      setSearchTerm(manufacturer);
      setShowDropdown(false);
      
      // Reset model selection
      setSelectedModel('');
    } catch (err) {
      console.error('Error selecting manufacturer:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = async (model: string) => {
    try {
      setLoading(true);
      // If no model selected (All Models), fetch all manufacturer aircraft
      if (!model) {
        const response = await fetch('/api/aircraft/track-manufacturer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manufacturer: selectedManufacturer
          }),
        });
  
        const data = await response.json();
        if (data.liveAircraft) {
          setActiveCount(data.liveAircraft.length);
          onAircraftUpdate(data.liveAircraft);
        }
      } else {
        // If model selected, filter for only that model's aircraft
        const response = await fetch('/api/aircraft/track-manufacturer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manufacturer: selectedManufacturer,
            model: model
          }),
        });
  
        const data = await response.json();
        
        if (data.liveAircraft) {
          // Filter aircraft to only show selected model
          const filteredAircraft = data.liveAircraft.filter(
            (aircraft: any) => aircraft.model === model
          );
          setActiveCount(filteredAircraft.length);
          onAircraftUpdate(filteredAircraft); // Send only filtered aircraft to MapWrapper
        }
      }
  
      onModelSelect(model);
      setSelectedModel(model);
    } catch (err) {
      console.error('Error selecting model:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) {
    return (
      <button 
        onClick={() => setIsVisible(true)}
        className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg px-4 py-2 text-gray-700"
      >
        Select Aircraft
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg w-[350px]">
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Active Aircraft Count */}
        <div className="text-blue-600 mb-4">
          Active Aircraft: {activeCount}
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onClick={() => setShowDropdown(true)}
              placeholder="Search manufacturer..."
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
            />
            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
          </div>
          <div className="relative">
            <input
              type="text"
              value={nNumber}
              onChange={(e) => setNNumber(e.target.value.toUpperCase())}
              placeholder="N#"
              className="w-20 pl-8 pr-2 py-2 bg-gray-50 border border-gray-200 rounded-lg"
            />
            <Plane className="absolute left-2 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Selected Info with Model Selection */}
        {selectedManufacturer && (
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-blue-600 font-medium">
              {selectedManufacturer}
            </div>
            <div className="text-blue-500 text-sm mb-2">
              Active: {activeCount}
            </div>
            
            <select
              value={selectedModel}
              onChange={(e) => handleModelSelect(e.target.value)}
              className="w-full p-2 border border-blue-200 rounded bg-white"
            >
              <option value="">All Models ({activeCount})</option>
              {models.map((model) => (
                <option key={model.model} value={model.model}>
                  {model.model} ({model.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Manufacturer Dropdown */}
        {showDropdown && (
          <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
            {loading ? (
              <div className="p-2 text-center text-gray-500">Loading...</div>
            ) : manufacturers.length > 0 ? (
              manufacturers
                .filter(m => !searchTerm || m.label.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((manufacturer) => (
                  <button
                    key={manufacturer.value}
                    onClick={() => handleManufacturerSelect(manufacturer.value)}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 flex justify-between items-center border-b border-gray-100 last:border-0"
                  >
                    <span>{manufacturer.label}</span>
                    <span className="text-gray-500">
                      {manufacturer.count?.toLocaleString()}
                    </span>
                  </button>
                ))
            ) : (
              <div className="p-2 text-center text-gray-500">
                No manufacturers found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedSelector;