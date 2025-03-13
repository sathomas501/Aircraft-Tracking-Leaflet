import { useState, useEffect } from 'react';
import { SelectOption } from '@/types/base';
import { icao24CacheService } from '@/lib/services/icao24Cache';

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManufacturers = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/aircraft/manufacturers');
        if (!response.ok) throw new Error('Failed to fetch manufacturers');

        const data = await response.json();
        setManufacturers(data.manufacturers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchManufacturers();
  }, []);

  // ✅ Pass `manufacturer` as an argument instead of using an undefined variable
  const fetchManufacturerIcao24s = async (
    manufacturer: string
  ): Promise<string[]> => {
    if (!manufacturer) {
      console.warn(`[useFetchManufacturers] ⚠️ Manufacturer is undefined.`);
      return [];
    }

    try {
      console.log(
        `[useFetchManufacturers] 🔍 Fetching ICAO24s for ${manufacturer}`
      );

      // ✅ Ensure no direct recursion
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        console.error(
          `[useFetchManufacturers] ❌ Failed to fetch ICAO24s: ${response.statusText}`
        );
        return [];
      }

      const data = await response.json();
      return data?.data?.icao24List ?? []; // ✅ Proper data extraction
    } catch (error) {
      console.error(
        `[useFetchManufacturers] ❌ Error fetching ICAO24s:`,
        error
      );
      return [];
    }
  };

  // ✅ Ensure this function is correctly returned
  return { manufacturers, fetchManufacturerIcao24s, loading, error };
};
