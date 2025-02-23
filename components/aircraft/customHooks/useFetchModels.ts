import { useState, useEffect, useCallback } from 'react';
import { useAircraftData } from './useAircraftData';
import { fetchModels } from '../tracking/selector/services/aircraftService';
import { Model, SelectOption } from '@/types/base';

export const useFetchModels = () => {
  const { selectedManufacturer } = useAircraftData();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const loadModels = useCallback(async () => {
    if (!selectedManufacturer) {
      console.log('[useFetchModels] No manufacturer selected, clearing models');
      setModels([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(
        `[useFetchModels] 🔄 Fetching models for: ${selectedManufacturer.label}`
      );

      // ✅ Extract manufacturer name properly
      const fetchedModels = await fetchModels(selectedManufacturer.value);

      console.log(
        `[useFetchModels] ✅ Received ${fetchedModels.length} models:`,
        fetchedModels
      );

      setModels(fetchedModels);
    } catch (err) {
      console.error('[useFetchModels] ❌ Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load models'));
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [selectedManufacturer]);

  useEffect(() => {
    console.log(
      '[useFetchModels] 🔄 Effect triggered with manufacturer:',
      selectedManufacturer
    );
    loadModels();
  }, [loadModels]);

  return { models, loading, error };
};
