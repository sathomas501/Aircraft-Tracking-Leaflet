import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plane, X, Minus } from 'lucide-react';
import { 
  Aircraft, 
  CachedAircraftData, 
  SelectOption
} from '@/types/base';
import UnifiedCacheService, { UnsubscribeFunction } from '@/lib/services/managers/unified-cache-system';
import { startPolling, stopPolling, subscribe } from '@/lib/services/polling-service';
import { transformToAircraft, transformToCachedData } from '../../../utils/aircraft-helpers';


interface UnifiedSelectorProps {
  selectedType: string;
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelCounts: Map<string, number>;
  updateModelCounts: (counts: Map<string, number>) => void;  // Add this
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
  const [cacheSubscription, setCacheSubscription] = useState<UnsubscribeFunction | null>(null);
  const cacheService = UnifiedCacheService.getInstance();

  console.log('[UnifiedSelector] Component rendered with model:', selectedModel);

  useEffect(() => {
    console.log('[UnifiedSelector] Selected model changed:', selectedModel);
  }, [selectedModel]);

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

  useEffect(() => {
    return () => {
      if (cacheSubscription) {
        cacheSubscription();
      }
    };
  }, [cacheSubscription]);

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
    console.log('[Select] Manufacturer:', manufacturer);
    try {
        setLoading(true);
        
        const requestBody = { manufacturer };
        console.log('[Select] Request body:', requestBody);
        
        const response = await fetch('/api/aircraft/track-manufacturer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        
        const data = await response.json();
        console.log('[Select] Response:', data);

        if (data.liveAircraft) {
            onManufacturerSelect(manufacturer);
            setSearchTerm(manufacturer);
            setShowDropdown(false);
            setSelectedModel('');
        }
    } catch (err) {
        console.error('[Select] Error:', err);
    } finally {
        setLoading(false);
    }
};


  // Add this state to track model counts from cached data
  const [localModelCounts, setLocalModelCounts] = useState<Map<string, number>>(new Map());

// Add this function to update model counts from cache
const updateModelCounts = useCallback(() => {
  const key = selectedManufacturer.trim().toUpperCase();
  const cachedData = cacheService.getLiveData(key);
  
  if (cachedData && cachedData.length > 0) {
    const counts = new Map<string, number>();
    const aircraft = cachedData.map(transformToAircraft);
    
    aircraft.forEach(ac => {
      if (ac.model) {
        counts.set(ac.model, (counts.get(ac.model) || 0) + 1);
      }
    });
    
    // Update the models array with new counts
    setModels(prevModels => 
      prevModels.map(model => ({
        ...model,
        count: counts.get(model.model) || 0
      }))
    );
    
    onAircraftUpdate(aircraft);
    setActiveCount(aircraft.length);
  }
}, [selectedManufacturer]);

// Update useEffect for models to use the new counts
useEffect(() => {
  const updateModelCounts = () => {
    if (!selectedManufacturer) return;
    
    const key = selectedManufacturer.trim().toUpperCase();
    const cachedData = cacheService.getLiveData(key);
    
    if (cachedData && cachedData.length > 0) {
      const transformedAircraft = cachedData.map(transformToAircraft);
      setActiveCount(transformedAircraft.length);
      
      // Update models with counts from cache
      setModels(prevModels => 
        prevModels.map(model => ({
          ...model,
          count: transformedAircraft.filter(ac => ac.model === model.model).length
        }))
      );
    }
  };

  updateModelCounts();
}, [selectedManufacturer, cacheService]);

const handleModelSelect = async (newModel: string) => {
  console.log('[ModelSelect] Starting model selection for:', newModel);
  try {
    setLoading(true);
    // Clear existing polling first
    stopPolling();
    
    const key = selectedManufacturer.trim().toUpperCase();
    const cachedData = cacheService.getLiveData(key);
    
    if (cachedData && cachedData.length > 0) {
      // First, clear existing aircraft
      onAircraftUpdate([]);
      console.log('[ModelSelect] Cleared existing aircraft');
      
      const allTransformedAircraft = cachedData.map(transformToAircraft);
      console.log('[ModelSelect] All aircraft:', {
        total: allTransformedAircraft.length,
        sampleModels: allTransformedAircraft.slice(0, 3).map(ac => ac.model)
      });
      
      const filteredAircraft = newModel 
        ? allTransformedAircraft.filter(ac => ac.model === newModel)
        : allTransformedAircraft;
      
      console.log('[ModelSelect] Filtered aircraft:', {
        count: filteredAircraft.length,
        sampleIcao: filteredAircraft.slice(0, 3).map(ac => ac.icao24)
      });

      // Update map with filtered aircraft BEFORE starting new polling
      onAircraftUpdate(filteredAircraft);
      console.log('[ModelSelect] Updated map with filtered aircraft');
      
      setActiveCount(filteredAircraft.length);

      if (filteredAircraft.length > 0) {
        const icao24List = filteredAircraft.map(ac => ac.icao24);
        console.log('[ModelSelect] Starting polling with filtered ICAO list:', icao24List.length);
        
        subscribe(
          (pollingData) => {
            if (pollingData && Array.isArray(pollingData)) {
              const updatedAircraft = pollingData
                .map(transformToAircraft)
                .filter(ac => !newModel || ac.model === newModel);
              
              console.log('[Polling] Update:', {
                received: pollingData.length,
                filtered: updatedAircraft.length,
                model: newModel,
                sampleIcao: updatedAircraft.slice(0, 3).map(ac => ac.icao24)
              });
              
              // First update map
              onAircraftUpdate(updatedAircraft);
              setActiveCount(updatedAircraft.length);
              
              // Then update cache
              const newCachedData = pollingData.map(transformToCachedData);
              cacheService.setLiveData(key, newCachedData);
            }
          },
          (error) => console.error('[Polling] Error:', error)
        );
        
        startPolling(icao24List);
      } else {
        console.log('[ModelSelect] No matching aircraft, clearing map');
        onAircraftUpdate([]);
        setActiveCount(0);
      }
    } else {
      console.log('[ModelSelect] No cached data found');
      onAircraftUpdate([]);
      setActiveCount(0);
    }
    
    setSelectedModel(newModel);
    onModelSelect(newModel);
    
  } catch (err) {
    console.error('[ModelSelect] Error:', err);
    setActiveCount(0);
    onAircraftUpdate([]);
  } finally {
    setLoading(false);
  }
};
  
const renderModelSelect = () => (
  <select
    value={selectedModel}
    onChange={(e) => {
      console.log('[UI] Model select changed to:', e.target.value);
      handleModelSelect(e.target.value);
    }}
    className="w-full p-2 border border-blue-200 rounded bg-white"
  >
    <option value="">All Models ({activeCount})</option>
    {models.map((model) => (
      <option key={model.model} value={model.model}>
        {model.model} ({model.count || 0})
      </option>
    ))}
  </select>
);

  const [isMinimized, setIsMinimized] = useState(false);

// Add this function
const toggleMinimize = () => {
  setIsMinimized(!isMinimized);
};

// Update the return statement
if (isMinimized) {
  return (
    <button 
      onClick={toggleMinimize}
      className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg px-4 py-2 text-gray-700 hover:bg-gray-50"
    >
      <div className="flex items-center gap-2">
        <Plane size={16} />
        <span>Select Aircraft</span>
      </div>
    </button>
  );
}

return (
  <div className="absolute top-4 left-4 z-[2000] bg-white rounded-lg shadow-lg w-[350px]">
    <div className="p-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-gray-700 text-lg">Select Aircraft</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <Minus size={20} />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="text-blue-600 mb-4">
        Active Aircraft: {activeCount}
      </div>

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
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <div className="text-blue-600 font-medium">{selectedManufacturer}</div>
          <div className="text-blue-500 text-sm mb-2">Active: {activeCount}</div>
          {renderModelSelect()}
          
          <select
            value={selectedModel}
            onChange={(e) => handleModelSelect(e.target.value)}
            className="w-full p-2 border border-blue-200 rounded bg-white"
          >
            <option value="">All Models ({activeCount})</option>
            {models.map((model) => (
              <option key={model.model} value={model.model}>
                {model.model} ({model.count || 0})
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
            filteredManufacturers.map((manufacturer) => (
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
);}

export default UnifiedSelector;
