import { useState, useEffect } from 'react';
import { RegionCode } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

export function useManufacturerFilter(selectedRegion: RegionCode | null) {
  const {
    selectManufacturer,
    selectModel,
    updateGeofenceAircraft,
    clearGeofenceData,
  } = useEnhancedMapContext();

  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [manufacturerOptions, setManufacturerOptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]); // ✅ for useModelFilter
  const [modelsLoading, setModelsLoading] = useState(false);

  // Load manufacturers when region changes
  useEffect(() => {
    if (selectedRegion === null || typeof selectedRegion === 'string') {
      setManufacturerOptions([]);
      return;
    }

    setIsLoading(true);
    fetch(`/api/tracking/manufacturers?region=${selectedRegion}`)
      .then((res) => res.json())
      .then((data) => setManufacturerOptions(data))
      .catch((err) => {
        console.error(
          '[ManufacturerFilter] Failed to load manufacturers:',
          err
        );
      })
      .finally(() => setIsLoading(false));
  }, [selectedRegion]);

  // Fetch models for selected manufacturer
  useEffect(() => {
    if (selectedManufacturer) {
      setModelsLoading(true);
      fetch(
        `/api/aircraft/tracking/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`
      )
        .then((res) => res.json())
        .then((data) => setModels(data))
        .catch((err) => console.error('[ModelFetcher] Error:', err))
        .finally(() => setModelsLoading(false));
    } else {
      setModels([]); // reset
    }
  }, [selectedManufacturer]);

  const selectManufacturerAndFilter = (manufacturer: string) => {
    setSelectedManufacturer(manufacturer);
    setManufacturerSearchTerm('');
    selectManufacturer(manufacturer);
    selectModel(null);

    if (selectedRegion !== null) {
      fetchAircraftByRegionAndManufacturer(selectedRegion, manufacturer);
    }
  };

  const fetchAircraftByRegionAndManufacturer = async (
    region: RegionCode,
    manufacturer: string,
    page: number = 1,
    limit: number = 500
  ) => {
    try {
      const res = await fetch(
        `/api/tracking/filtered-aircraft?region=${region}&manufacturer=${encodeURIComponent(manufacturer)}&page=${page}&limit=${limit}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch');
      clearGeofenceData();
      updateGeofenceAircraft(data.aircraft || []);
    } catch (error) {
      console.error('[Fetch] Aircraft by region + manufacturer failed:', error);
    }
  };

  return {
    selectedManufacturer,
    manufacturerSearchTerm,
    setManufacturerSearchTerm,
    manufacturerOptions,
    selectManufacturerAndFilter,
    isLoading,
    models, // ✅ exposed
    modelsLoading, // ✅ exposed
  };
}
