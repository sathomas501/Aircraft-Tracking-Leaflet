import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchModels } from '../tracking/selector/services/aircraftService';
import { Model } from '@/types/base';
import { useRequestDeduplication } from './useRequestDeduplication';

// In-memory cache keyed by manufacturer value.
const modelsCache: {
  [manufacturer: string]: { models: Model[]; timestamp: number };
} = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Sorts models by descending activeCount and alphabetically by model name.
 */
const sortModels = (models: Model[]): Model[] => {
  return [...models].sort((a, b) => {
    const countA = a.activeCount || 0;
    const countB = b.activeCount || 0;
    const countDiff = countB - countA;
    return countDiff !== 0
      ? countDiff
      : (a.model || '').localeCompare(b.model || '');
  });
};

export const useFetchModels = (
  manufacturer: string | null,
  manufacturerLabel?: string
) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Get the deduplication hook
  const { dedupedRequest, cleanup } = useRequestDeduplication();

  const loadModels = useCallback(async () => {
    if (!manufacturer) {
      console.log('[useFetchModels] No manufacturer selected, clearing models');
      setModels([]);
      return;
    }

    const manufacturerKey = manufacturer;
    const displayName = manufacturerLabel || manufacturer;
    const cachedEntry = modelsCache[manufacturerKey];

    // Use cache if available and not expired.
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
      console.log(`[useFetchModels] Using cached models for: ${displayName}`);
      setModels(cachedEntry.models);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[useFetchModels] 🔄 Fetching models for: ${displayName}`);

      // Use deduplication with a unique key
      const key = `Models-${manufacturerKey}`;
      const fetchedModels = await dedupedRequest(key, async () => {
        return fetchModels(manufacturerKey);
      });

      console.log(
        `[useFetchModels] ✅ Received ${fetchedModels.length} models`
      );

      // Sort models before caching and updating state.
      const sortedModels = sortModels(fetchedModels);
      modelsCache[manufacturerKey] = {
        models: sortedModels,
        timestamp: Date.now(),
      };
      setModels(sortedModels);
    } catch (err) {
      console.error('[useFetchModels] ❌ Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load models'));
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [manufacturer, manufacturerLabel, dedupedRequest]);

  useEffect(() => {
    console.log(
      '[useFetchModels] Effect triggered with manufacturer:',
      manufacturer
    );
    loadModels();
  }, [loadModels]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    models,
    loading,
    error,
    refreshModels: loadModels,
  };
};
