import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { SelectOption, Aircraft, StaticModel, ActiveModel } from '@/types/base';
import { useRequestDeduplication } from '../../customHooks/useRequestDeduplication';

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (manufacturer: string | null) => Promise<void>;
  setSelectedManufacturer: (manufacturer: string | null) => void;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: ActiveModel[]) => void;
  onError: (message: string) => void;
}

// Cache implementation
class ModelsCache {
  private static instance: ModelsCache;
  private cache: Map<
    string,
    {
      models: ActiveModel[];
      timestamp: number;
      promise?: Promise<ActiveModel[]>;
      lastFetch?: number;
      retryCount?: number;
    }
  > = new Map();

  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_WHILE_REVALIDATE = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_FETCH_INTERVAL = 10 * 1000; // 10 seconds
  private readonly MAX_RETRIES = 3;

  private constructor() {
    // Cleanup old cache entries periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupCache(), this.CACHE_DURATION);
    }
  }

  static getInstance(): ModelsCache {
    if (!this.instance) {
      this.instance = new ModelsCache();
    }
    return this.instance;
  }

  get(manufacturer: string): { models: ActiveModel[] | null; stale: boolean } {
    const entry = this.cache.get(manufacturer);
    if (!entry) return { models: null, stale: false };

    const now = Date.now();
    const age = now - entry.timestamp;

    // Fresh data
    if (age <= this.CACHE_DURATION) {
      return { models: entry.models, stale: false };
    }

    // Stale but usable
    if (age <= this.STALE_WHILE_REVALIDATE) {
      return { models: entry.models, stale: true };
    }

    // Too old
    this.cache.delete(manufacturer);
    return { models: null, stale: false };
  }

  async getWithRevalidate(
    manufacturer: string,
    fetchFn: () => Promise<ActiveModel[]>
  ): Promise<ActiveModel[]> {
    const { models, stale } = this.get(manufacturer);
    const entry = this.cache.get(manufacturer);
    const now = Date.now();

    // Check if we should fetch new data
    const shouldFetch =
      stale ||
      !models ||
      !entry?.lastFetch ||
      now - entry.lastFetch > this.MIN_FETCH_INTERVAL;

    if (shouldFetch && (!entry?.promise || stale)) {
      // Start revalidation
      const fetchPromise = this.fetchWithRetry(manufacturer, fetchFn);
      this.setPromise(manufacturer, fetchPromise);

      try {
        const newModels = await fetchPromise;
        this.set(manufacturer, newModels);
        return newModels;
      } catch (error) {
        // If we have stale data, use it on error
        if (models) return models;
        throw error;
      }
    }

    return models || [];
  }

  getPromise(manufacturer: string): Promise<ActiveModel[]> | null {
    return this.cache.get(manufacturer)?.promise || null;
  }

  setPromise(manufacturer: string, promise: Promise<ActiveModel[]>): void {
    const existing = this.cache.get(manufacturer) || {
      models: [],
      timestamp: Date.now(),
    };
    this.cache.set(manufacturer, { ...existing, promise });
  }

  clearPromise(manufacturer: string): void {
    const existing = this.cache.get(manufacturer);
    if (existing) {
      const { promise, ...rest } = existing;
      this.cache.set(manufacturer, rest);
    }
  }

  private async fetchWithRetry(
    manufacturer: string,
    fetchFn: () => Promise<ActiveModel[]>
  ): Promise<ActiveModel[]> {
    const entry = this.cache.get(manufacturer);
    const retryCount = entry?.retryCount || 0;

    try {
      const models = await fetchFn();
      // Reset retry count on success
      if (entry) entry.retryCount = 0;
      return models;
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );

        this.cache.set(manufacturer, {
          ...(entry || { models: [], timestamp: Date.now() }),
          retryCount: retryCount + 1,
        });

        return this.fetchWithRetry(manufacturer, fetchFn);
      }
      throw error;
    }
  }

  set(manufacturer: string, models: ActiveModel[]): void {
    const now = Date.now();
    const existing = this.cache.get(manufacturer);

    this.cache.set(manufacturer, {
      ...(existing || {}),
      models,
      timestamp: now,
      lastFetch: now,
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.STALE_WHILE_REVALIDATE) {
        this.cache.delete(key);
      }
    }
  }
}

const modelsCache = ModelsCache.getInstance();

export const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onSelect,
  setSelectedManufacturer,
  onAircraftUpdate,
  onModelsUpdate,
  onError,
}) => {
  // ✅ Use `dedupedRequest` properly
  const { dedupedRequest } = useRequestDeduplication(); // ✅ Ensure it's called inside a function
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [models, setModels] = useState<ActiveModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Memoize fetch function to prevent recreating it on every render
  const fetchModelsData = async (
    manufacturer: string
  ): Promise<ActiveModel[]> => {
    if (!manufacturer) return [];

    const encodedManufacturer = encodeURIComponent(manufacturer.trim());
    const url = `/api/aircraft/models?manufacturer=${encodedManufacturer}`;

    try {
      console.log(`[fetchModelsData] 🔄 Fetching models for ${manufacturer}`);

      const response = await dedupedRequest(url, async () => {
        const modelsResponse = await fetch(url, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!modelsResponse.ok) {
          throw new Error(
            `Failed to fetch models: ${modelsResponse.statusText}`
          );
        }

        return modelsResponse.json(); // ✅ Directly return the JSON response
      });

      // ✅ No `success` or `data` properties—use response directly
      if (!Array.isArray(response)) {
        throw new Error('[fetchModelsData] ❌ Invalid API response');
      }

      return response.map((model: any) => ({
        model: model.model || '',
        manufacturer: model.manufacturer || '',
        label: `${model.model || 'Unknown'} (${model.activeCount ?? 0} active)`,
        activeCount: model.activeCount ?? 0,
        totalCount: model.totalCount ?? model.count ?? 0,
      }));
    } catch (error) {
      console.error('[fetchModelsData] ❌ Error:', error);
      return [];
    }
  };

  const handleManufacturerSelect = useCallback(
    async (manufacturer: SelectOption) => {
      if (!manufacturer.value || manufacturer.value === selectedManufacturer) {
        console.log(
          '[ManufacturerSelector] ⏳ Already selected, skipping fetch'
        );
        return;
      }

      if (isLoadingModels) {
        console.log('[ManufacturerSelector] ⏳ Fetch already in progress');
        return;
      }

      setIsLoadingModels(true);
      setSelectedManufacturer(manufacturer.value);

      try {
        // ✅ Step 1: Check cache before making a network request
        const cachedModels = modelsCache.get(manufacturer.value);
        if (cachedModels?.models && !cachedModels.stale) {
          console.log('[ManufacturerSelector] ✅ Using cached models');
          setModels(cachedModels.models);
          onModelsUpdate(cachedModels.models);
          return;
        }

        // ✅ Step 2: Use `dedupedRequest` to prevent duplicate API calls
        const fetchPromise = dedupedRequest(
          `fetchModels-${manufacturer.value}`,
          async () => fetchModelsData(manufacturer.value)
        );

        const response = await fetchPromise;

        // ✅ Step 3: Validate and process the response
        if (!Array.isArray(response)) {
          throw new Error('[ManufacturerSelector] ❌ Invalid API response');
        }

        const processedModels = response.map((model: any) => ({
          model: model.model || 'Unknown',
          manufacturer: model.manufacturer || '',
          label: `${model.model || 'Unknown'} (${model.activeCount ?? 0} active)`,
          activeCount: Number.isFinite(model.activeCount)
            ? model.activeCount
            : 0,
          totalCount: Number.isFinite(model.totalCount)
            ? model.totalCount
            : Number.isFinite(model.count)
              ? model.count
              : 0,
        }));

        // ✅ Step 4: Cache models and update UI
        modelsCache.set(manufacturer.value, processedModels);
        setModels(processedModels);
        onModelsUpdate(processedModels);
      } catch (error) {
        console.error('[ManufacturerSelector] ❌ Error:', error);
        onError('Failed to fetch aircraft models');
        setModels([]);
        onModelsUpdate([]);
        onAircraftUpdate([]);
      } finally {
        setIsLoadingModels(false);
      }
    },
    [
      selectedManufacturer,
      isLoadingModels,
      onModelsUpdate,
      onAircraftUpdate,
      onError,
      setSelectedManufacturer,
      fetchModelsData,
      dedupedRequest, // ✅ Include this as a dependency
    ]
  );

  const handleReset = async () => {
    try {
      setIsSelecting(true);
      setSelectedManufacturer(null);
      setSearchTerm('');
      setIsOpen(false);
      setModels([]);
      setSelectedModel('');
      await onSelect(null);
    } catch (error) {
      console.error('Failed to reset:', error);
      onError('Failed to reset selection');
    } finally {
      setIsSelecting(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredManufacturers = useMemo(
    () =>
      manufacturers.filter((manufacturer: SelectOption) =>
        manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [manufacturers, searchTerm]
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <input
        type="text"
        className="w-full px-4 py-2 border rounded-md"
        placeholder="Search or select manufacturer..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        disabled={isSelecting}
      />

      {isOpen && filteredManufacturers.length > 0 && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.map((manufacturer) => (
            <div
              key={manufacturer.value}
              className={`px-4 py-2 hover:bg-gray-200 cursor-pointer ${
                isSelecting ? 'opacity-50' : ''
              } ${selectedManufacturer === manufacturer.value ? 'bg-blue-100' : ''}`}
              onClick={() =>
                !isSelecting && handleManufacturerSelect(manufacturer)
              }
            >
              {manufacturer.label}
              {modelsCache.get(manufacturer.value) && (
                <span className="ml-2 text-xs text-green-600">✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedManufacturer && (
        <button
          onClick={handleReset}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
          type="button"
          disabled={isSelecting}
        >
          Reset
        </button>
      )}

      {isLoadingModels && (
        <div className="mt-2 text-blue-600">Loading models...</div>
      )}
    </div>
  );
};

export default ManufacturerSelector;
