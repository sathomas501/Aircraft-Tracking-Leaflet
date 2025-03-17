// ModelContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AircraftModel } from '@/types/aircraft-models';

interface ModelContextType {
  models: AircraftModel[];
  selectedModel: string | null;
  isLoading: boolean;
  setSelectedModel: (model: string | null) => void;
  refreshModels: () => Promise<void>;
  status: string;
  lastUpdated: Date | null;
  totalActive: number;
  totalInactive: number;
}

interface ModelCache {
  [manufacturer: string]: {
    models: AircraftModel[];
    timestamp: number;
  };
}

// Create context with default values
const ModelContext = createContext<ModelContextType>({
  models: [],
  selectedModel: null,
  isLoading: false,
  setSelectedModel: () => {},
  refreshModels: async () => {},
  status: '',
  lastUpdated: null,
  totalActive: 0,
  totalInactive: 0,
});

interface ModelProviderProps {
  children: React.ReactNode;
  manufacturer: string | null;
  onStatusChange?: (status: string) => void;
}

export function ModelProvider({
  children,
  manufacturer,
  onStatusChange,
}: ModelProviderProps) {
  const [models, setModels] = useState<AircraftModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cache, setCache] = useState<ModelCache>({});

  // Calculate stats
  const totalActive = React.useMemo(
    () => models.reduce((sum, model) => sum + (model.activeCount || 0), 0),
    [models]
  );

  const totalInactive = React.useMemo(
    () =>
      models.reduce(
        (sum, model) =>
          sum +
          ((model.totalCount || model.count || 0) - (model.activeCount || 0)),
        0
      ),
    [models]
  );

  // Update parent status when local status changes
  useEffect(() => {
    if (onStatusChange && status) {
      onStatusChange(status);
    }
  }, [status, onStatusChange]);

  // Clear selected model when manufacturer changes
  useEffect(() => {
    setSelectedModel(null);
  }, [manufacturer]);

  // Load models when manufacturer changes
  useEffect(() => {
    if (!manufacturer) {
      setModels([]);
      return;
    }

    // Check cache first
    if (
      cache[manufacturer] &&
      Date.now() - cache[manufacturer].timestamp < 5 * 60 * 1000
    ) {
      setModels(cache[manufacturer].models);
      setStatus(
        `Loaded ${cache[manufacturer].models.length} models from cache`
      );
      setLastUpdated(new Date(cache[manufacturer].timestamp));
      return;
    }

    fetchModels(manufacturer);
  }, [manufacturer, cache]);

  const fetchModels = async (manufacturer: string) => {
    if (!manufacturer) return;

    setIsLoading(true);
    setStatus('Loading models...');

    try {
      console.log(`[ModelContext] Fetching models for ${manufacturer}...`);
      const response = await fetch('/api/aircraft/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch models');
      }

      const newModels = data.models || [];
      console.log(`[ModelContext] Received ${newModels.length} models`);

      // Sort models by active count
      const sortedModels = [...newModels].sort((a, b) => {
        // First by active count (descending)
        const activeCountDiff = (b.activeCount || 0) - (a.activeCount || 0);
        if (activeCountDiff !== 0) return activeCountDiff;

        // Then alphabetically by model name
        return a.model.localeCompare(b.model);
      });

      setModels(sortedModels);

      // Update cache
      const timestamp = Date.now();
      setCache((prev) => ({
        ...prev,
        [manufacturer]: {
          models: sortedModels,
          timestamp,
        },
      }));

      setLastUpdated(new Date(timestamp));
      setStatus(`Loaded ${sortedModels.length} models for ${manufacturer}`);
    } catch (error) {
      console.error('[ModelContext] Error loading models:', error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const refreshModels = async () => {
    if (!manufacturer) return;

    // Force bypass cache
    return fetchModels(manufacturer);
  };

  const value = {
    models,
    selectedModel,
    setSelectedModel,
    isLoading,
    refreshModels,
    status,
    lastUpdated,
    totalActive,
    totalInactive,
  };

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
}

// Custom hook to use the model context
export const useModels = () => useContext(ModelContext);
