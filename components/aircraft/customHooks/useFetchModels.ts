import { useState, useEffect, useCallback } from 'react';
import { fetchModels, Model } from '../selector/services/aircraftService';

export const useFetchModels = (manufacturer: string) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [prevManufacturer, setPrevManufacturer] = useState<string | null>(null);

  // Function to fetch models
  const loadModels = useCallback(async () => {
    if (!manufacturer || manufacturer === prevManufacturer) return;

    setLoading(true);
    setError(null); // Reset error state
    setPrevManufacturer(manufacturer); // Store selected manufacturer

    try {
      console.log(`📡 Fetching models for manufacturer: ${manufacturer}`);
      const fetchedModels = await fetchModels(manufacturer);

      if (Array.isArray(fetchedModels)) {
        setModels(fetchedModels);
      } else {
        console.warn(`⚠️ Unexpected API response for models:`, fetchedModels);
        setModels([]);
      }
    } catch (err) {
      console.error('❌ Error fetching models:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to load models.')
      );
    } finally {
      setLoading(false);
    }
  }, [manufacturer, prevManufacturer]);

  // Fetch models when manufacturer changes
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return { models, loading, error, reload: loadModels };
};
