import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  // Get the deduplication hook
  const { dedupedRequest, cleanup } = useRequestDeduplication();

  // Existing loadModels function
  const loadModels = useCallback(async () => {
    // Your existing code...
  }, [manufacturer, manufacturerLabel, dedupedRequest]);

  // Add a new function to update models from static DB
  const updateModelsFromStaticDb = useCallback(async () => {
    if (!manufacturer) {
      console.log(
        '[useFetchModels] No manufacturer selected, cannot update models'
      );
      return { updated: 0, message: 'No manufacturer selected' };
    }

    setLoading(true);
    setUpdateStatus('Updating models...');

    try {
      console.log(`[useFetchModels] 🔄 Updating models for: ${manufacturer}`);

      const response = await fetch('/api/aircraft/update-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update models: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[useFetchModels] ✅ Updated ${data.updated} models`);

      // If models were updated, refresh the list
      if (data.updated > 0) {
        // Invalidate cache for this manufacturer
        delete modelsCache[manufacturer];
        // Reload models to get fresh data
        await loadModels();
      }

      setUpdateStatus(`Updated ${data.updated} aircraft models`);
      return data;
    } catch (err) {
      console.error('[useFetchModels] ❌ Error updating models:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to update models')
      );
      setUpdateStatus('Failed to update models');
      throw err;
    } finally {
      setLoading(false);
      // Clear update status after a delay
      setTimeout(() => setUpdateStatus(null), 3000);
    }
  }, [manufacturer, loadModels]);

  // Your existing useEffects...

  return {
    models,
    loading,
    error,
    updateStatus,
    refreshModels: loadModels,
    updateModels: updateModelsFromStaticDb,
  };
};
