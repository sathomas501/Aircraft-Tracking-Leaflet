import { useState, useEffect } from 'react';
import { fetchModels, Model } from '../selector/services/aircraftService';

export const useFetchModels = (manufacturer: string) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      if (!manufacturer) {
        setModels([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null); // Clear previous errors

      try {
        const fetchedModels = await fetchModels(manufacturer);
        setModels(fetchedModels);
      } catch (err) {
        console.error('Error fetching models:', err);
        setError('Failed to load models.');
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [manufacturer]);

  return { models, loading, error };
};
