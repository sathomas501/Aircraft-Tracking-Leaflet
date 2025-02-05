import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plane, X, Minus } from 'lucide-react';
import { Aircraft, SelectOption } from '@/types/base';
import UnifiedCacheService, { UnsubscribeFunction } from '@/lib/services/managers/unified-cache-system';
import { transformToAircraft } from '../../../utils/aircraft-helpers';

interface UnifiedSelectorProps {
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelCounts: Map<string, number>;
  totalActive: number;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
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
  onReset,
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
  const [isMinimized, setIsMinimized] = useState(false);

  const cacheService = UnifiedCacheService.getInstance();

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

  // Update model counts from cache
  const updateModelCounts = useCallback(() => {
    if (!selectedManufacturer) return;

    const key = selectedManufacturer.trim().toUpperCase();
    const cachedData = cacheService.getLiveData(key);

    if (cachedData && cachedData.length > 0) {
      const transformedAircraft = cachedData.map(transformToAircraft);
      const modelCounts = new Map<string, number>();

      transformedAircraft.forEach((ac: Aircraft) => {
        if (ac.model) {
          modelCounts.set(ac.model, (modelCounts.get(ac.model) || 0) + 1);
        }
      });

      setActiveCount(transformedAircraft.length);
      setModels((prevModels) =>
        prevModels.map((model) => ({
          ...model,
          count: modelCounts.get(model.model) || 0,
        }))
      );
    }
  }, [selectedManufacturer, cacheService]);

  useEffect(() => {
    updateModelCounts();
    const intervalId = setInterval(updateModelCounts, 5000);
    return () => clearInterval(intervalId);
  }, [updateModelCounts]);

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
        const transformedAircraft = data.liveAircraft.map(transformToAircraft);
        onAircraftUpdate(transformedAircraft);
        setActiveCount(transformedAircraft.length);
        onManufacturerSelect(manufacturer);
        setSearchTerm(manufacturer);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error('[Select] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = async (newModel: string) => {
    try {
      setLoading(true);
      const key = selectedManufacturer.trim().toUpperCase();
      const cachedData = cacheService.getLiveData(key);

      if (cachedData && cachedData.length > 0) {
        const allTransformedAircraft = cachedData.map(transformToAircraft);
        const filteredAircraft = newModel
          ? allTransformedAircraft.filter((ac: Aircraft) => ac.model === newModel)
          : allTransformedAircraft;

        onAircraftUpdate(filteredAircraft);
        setActiveCount(filteredAircraft.length);
        setSelectedModel(newModel);
        onModelSelect(newModel);
      }
    } catch (err) {
      console.error('[ModelSelect] Error:', err);
      setActiveCount(0);
      onAircraftUpdate([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredManufacturers = useMemo(() => {
    if (!searchTerm) return manufacturers;
    return manufacturers.filter((m) =>
      m.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [manufacturers, searchTerm]);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

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
            <button onClick={toggleMinimize} className="text-gray-400 hover:text-gray-600 p-1">
              <Minus size={20} />
            </button>
            <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="text-blue-600 mb-4">Active Aircraft: {activeCount}</div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search manufacturer..."
          className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
        />

        {showDropdown && (
          <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
            {loading ? (
              <div className="p-2 text-center text-gray-500">Loading...</div>
            ) : (
              filteredManufacturers.map((manufacturer) => (
                <button
                  key={manufacturer.value}
                  onClick={() => handleManufacturerSelect(manufacturer.value)}
                  className="w-full px-4 py-2 text-left hover:bg-blue-50"
                >
                  {manufacturer.label}
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
