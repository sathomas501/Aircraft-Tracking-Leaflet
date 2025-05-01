import { useState, useEffect } from 'react';
import { RegionCode } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useFilterLogic } from './useFilterLogic';

export function useManufacturerFilter(selectedRegion: RegionCode | null) {
  const context = useEnhancedMapContext();

  // ✅ Short-circuit invalid regions
  if (
    selectedRegion === null ||
    typeof selectedRegion !== 'number' ||
    selectedRegion <= 0
  ) {
    return {
      selectedManufacturer: null,
      manufacturerSearchTerm: '',
      setManufacturerSearchTerm: () => {},
      manufacturerOptions: [],
      selectManufacturerAndFilter: () => {},
      isLoading: false,
      fetchModelsForManufacturer: () => {},
      applyAllFilters: () => {},
    };
  }

  const { fetchModelsForManufacturer = () => {}, applyAllFilters = () => {} } =
    useFilterLogic() ?? {};

  const {
    selectManufacturer,
    selectModel,
    updateGeofenceAircraft,
    clearGeofenceData,
  } = context;

  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [manufacturerOptions, setManufacturerOptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedRegion == null || isNaN(selectedRegion)) return;

    setIsLoading(true);
    fetch(`/api/tracking/manufacturers?region=${selectedRegion}`)
      .then((res) => res.json())
      .then((data) => setManufacturerOptions(data))
      .catch((err) => console.error('[ManufacturerFilter] Load error:', err))
      .finally(() => setIsLoading(false));
  }, [selectedRegion]);

  const selectManufacturerAndFilter = (manufacturer: string) => {
    setSelectedManufacturer(manufacturer);
    setManufacturerSearchTerm('');
    selectManufacturer(manufacturer);
    selectModel(null);

    fetchAircraftByRegionAndManufacturer(selectedRegion, manufacturer);
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
      if (!res.ok) throw new Error(data.message || 'Failed to fetch aircraft');
      clearGeofenceData();
      updateGeofenceAircraft(data.aircraft || []);
    } catch (err) {
      console.error('[ManufacturerFilter] Fetch aircraft failed:', err);
    }
  };

  return {
    selectedManufacturer,
    manufacturerSearchTerm,
    setManufacturerSearchTerm,
    manufacturerOptions,
    selectManufacturerAndFilter,
    isLoading,
    fetchModelsForManufacturer,
    applyAllFilters,
  };
}
