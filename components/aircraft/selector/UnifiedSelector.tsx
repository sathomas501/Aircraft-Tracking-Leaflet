import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plane, X } from 'lucide-react';
import { 
  Aircraft, 
  CachedAircraftData, 
  SelectOption,
  transformToCachedData,
  transformToAircraft
} from '@/types/base';
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import { manufacturerTracking } from '@/lib/services/manufacturer-tracking-service';

interface UnifiedSelectorProps {
  selectedType: string;
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelCounts: Map<string, number>;
  totalActive: number;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (updateData: Aircraft[]) => void;
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

  const cacheService = UnifiedCacheService.getInstance();

  // Filter manufacturers
  const filteredManufacturers = useMemo(() => {
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
    const key = manufacturer.trim().toUpperCase(); // Normalize key
    const cachedData = cacheService.getLiveData(key);
  
    // ✅ Serve cached data if available
    if (cachedData && cachedData.length > 0) {
      console.log(`[Cache] Serving cached data for ${manufacturer}`);
      onAircraftUpdate(cachedData.map(transformToAircraft));
      setActiveCount(cachedData.length);
      return; // 🚫 Skip API call if cache exists
    }
  
    try {
      setLoading(true);
      const response = await fetch('/api/aircraft/track-manufacturer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });
  
      const data = await response.json();
  
      if (data.liveAircraft) {
        const cachedData = data.liveAircraft.map(transformToCachedData);
        cacheService.setLiveData(key, cachedData); // Use normalized key
  
        manufacturerTracking.subscribe((trackingData) => {
          if (trackingData.aircraft) {
            const updatedCachedData = trackingData.aircraft.map(transformToCachedData);
            cacheService.setLiveData(key, updatedCachedData);
            console.log(`[Cache Debug] Data set for ${manufacturer}`, updatedCachedData);
  
            const updatedAircraftData = updatedCachedData.map(transformToAircraft);
            onAircraftUpdate(updatedAircraftData);
          }
        });
  
        setActiveCount(data.liveAircraft.length);
        const updatedAircraftData = data.liveAircraft.map(transformToAircraft);
        onAircraftUpdate(updatedAircraftData);
      }
  
      onManufacturerSelect(manufacturer);
      setSearchTerm(manufacturer);
      setShowDropdown(false);
      setSelectedModel('');
    } catch (err) {
      console.error('Error selecting manufacturer:', err);
    } finally {
      setLoading(false);
    }
  };

  let pollingInterval: NodeJS.Timeout | null = null;

const startPolling = (manufacturer: string, model: string) => {
  if (pollingInterval) clearInterval(pollingInterval); // Clear any previous polling

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/aircraft/track-manufacturer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer, model }),
      });
      const data = await response.json();

      console.log(`[Polling] Data for ${manufacturer} - ${model}:`, data);

      const transformedAircraft = data.map(transformToAircraft);
      const filteredAircraft: Aircraft[] = transformedAircraft.filter((ac: Aircraft) => ac.model === model);

      onAircraftUpdate(filteredAircraft); // Update with fresh polled data
      setActiveCount(filteredAircraft.length); // Update active count
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 5000); // Poll every 5 seconds
};

const stopPolling = () => {
  if (pollingInterval) clearInterval(pollingInterval);
};

const handleModelSelect = async (model: string) => {
  try {
    setLoading(true);
    stopPolling(); // Stop any previous polling when a new model is selected

    const cacheService = UnifiedCacheService.getInstance();
    const cachedAircraft = cacheService.getLiveData(selectedManufacturer.trim().toUpperCase());

    onAircraftUpdate([]); // ✅ Clear previous aircraft

    if (cachedAircraft) {
      const transformedAircraft = cachedAircraft.map(transformToAircraft);

      if (model) {
        const filteredAircraft = transformedAircraft.filter(ac => ac.model === model);
        setActiveCount(filteredAircraft.length);
        onAircraftUpdate(filteredAircraft);
        startPolling(selectedManufacturer.trim().toUpperCase(), model); // ✅ Start polling
      }
    } else {
      console.warn('No cached data found. Fetching from tracking DB.');
    }

    setSelectedModel(model);
    onModelSelect(model);

    if (model) {
      startPolling(selectedManufacturer, model); // ✅ Start polling for the selected model
    }
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
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="text-blue-600 mb-4">Active Aircraft: {activeCount}</div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
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

        {selectedManufacturer && (
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-blue-600 font-medium">{selectedManufacturer}</div>
            <div className="text-blue-500 text-sm mb-2">Active: {activeCount}</div>
            
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

        {showDropdown && (
          <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
            {loading ? (
              <div className="p-2 text-center text-gray-500">Loading...</div>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedSelector;
