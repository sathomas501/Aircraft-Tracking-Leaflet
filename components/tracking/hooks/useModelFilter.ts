import { useState, useEffect } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

export function useModelFilter(
  selectedManufacturer: string | null,
  applyAllFilters: () => void = () => {}
) {
  const mapContext = useEnhancedMapContext();

  const selectedModel = mapContext?.selectedModel ?? null;
  const selectModel = mapContext?.selectModel ?? (() => {});

  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedManufacturer) {
      setModelOptions([]);
      return;
    }

    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/tracking/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`
        );
        const data = await response.json();
        if (Array.isArray(data)) {
          setModelOptions(data);
        } else {
          setModelOptions([]);
        }
      } catch (err) {
        console.error('[useModelFilter] Failed to fetch models:', err);
        setModelOptions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [selectedManufacturer]);

  const handleModelSelect = (model: string) => {
    selectModel(model);
    applyAllFilters();
  };

  return {
    selectedModel,
    modelOptions,
    isLoading,
    handleModelSelect,
  };
}
