import { useState, useEffect, useCallback } from 'react';
import { useFetchManufacturers } from './useFetchManufactures';
import { trackManufacturer } from '../tracking/selector/ManufacturerSelector'; // ✅ Ensure correct import
import type { SelectOption } from '@/types/base';

export const useAircraftData = () => {
  const [selectedManufacturer, setSelectedManufacturer] =
    useState<SelectOption | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [liveAircraft, setLiveAircraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [prevManufacturer, setPrevManufacturer] = useState<string | null>(null);

  const manufacturers: SelectOption[] = selectedManufacturer
    ? [{ value: selectedManufacturer.value, label: selectedManufacturer.label }]
    : [];

  const fetchData = useCallback(async () => {
    if (
      !selectedManufacturer ||
      selectedManufacturer.value === prevManufacturer
    )
      return;

    setLoading(true);
    setError(null);
    setPrevManufacturer(selectedManufacturer.value);

    try {
      console.log(
        `📡 Fetching ICAO24s for manufacturer: ${selectedManufacturer.label}`
      );

      const result = await trackManufacturer(selectedManufacturer.value); // ✅ Ensure correct parameter type

      if (result && Array.isArray(result.liveAircraft)) {
        setActiveCount(result.liveAircraft.length);
        setLiveAircraft(result.liveAircraft);
      } else {
        setActiveCount(0);
        setLiveAircraft([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [selectedManufacturer, prevManufacturer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    manufacturers,
    selectedManufacturer,
    setSelectedManufacturer,
    activeCount,
    liveAircraft,
    loading,
    error,
    reload: fetchData,
  };
};
