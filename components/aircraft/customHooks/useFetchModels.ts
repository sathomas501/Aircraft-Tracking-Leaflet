import { useState, useEffect, useCallback } from 'react';
import { useFetchManufacturers } from './useFetchManufactures'; // ✅ Import manufacturer tracking

interface Model {
  model: string;
  activeCount: number;
  isActive: boolean;
}

export const useFetchModels = () => {
  const { manufacturers, loading: manufacturersLoading } =
    useFetchManufacturers();
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [prevManufacturer, setPrevManufacturer] = useState<string | null>(null);

  // Function to fetch models from API
  const loadModels = useCallback(async () => {
    if (!selectedManufacturer || selectedManufacturer === prevManufacturer)
      return;

    setLoading(true);
    setError(null);
    setPrevManufacturer(selectedManufacturer);

    try {
      console.log(
        `📡 Fetching models for manufacturer: ${selectedManufacturer}`
      );

      const response = await fetch(
        `/api/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setModels(result.data);
      } else {
        console.warn(`⚠️ Unexpected API response:`, result);
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
  }, [selectedManufacturer, prevManufacturer]);

  // Fetch models when manufacturer changes
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return {
    manufacturers,
    selectedManufacturer,
    setSelectedManufacturer, // ✅ Allows UI to update selected manufacturer
    models,
    loading: loading || manufacturersLoading, // ✅ Merges loading states
    error,
    reload: loadModels,
  };
};
