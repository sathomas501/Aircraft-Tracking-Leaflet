//components/aircraft/customHooks/useFetchModels

import { useState, useEffect } from 'react';
import { fetchModels, Model } from '../selector/services/aircraftService';


export const useFetchModels = (selectedManufacturer: string) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedManufacturer) {
      setModels([]);
      return;
    }

    const loadModels = async () => {
      setLoading(true);
      try {
        const data = await fetchModels(selectedManufacturer);
        setModels(data);
      } catch (error) {
        console.error('Error loading models:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [selectedManufacturer]);

  return { models, loading };
};
