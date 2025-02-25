import { useState, useEffect } from 'react';
import { fetchIcao24s } from '@/lib/services/icao24Cache';
import { SelectOption } from '@/types/base';

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [icao24s, setIcao24s] = useState<string[]>([]); // ✅ Ensure this exists
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManufacturers = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/aircraft/manufacturers');
        if (!response.ok) throw new Error('Failed to fetch manufacturers');

        const data = await response.json();
        setManufacturers(data.manufacturers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchManufacturers();
  }, []);

  // ✅ Ensure fetchIcao24s function exists and updates state
  const fetchManufacturerIcao24s = async (manufacturer: string) => {
    const icaoList = await fetchIcao24s(manufacturer);
    setIcao24s(icaoList); // ✅ Update state
    return icaoList;
  };

  return {
    manufacturers,
    icao24s,
    fetchIcao24s: fetchManufacturerIcao24s,
    loading,
    error,
  };
};
