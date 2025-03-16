import { useState, useEffect, useRef } from 'react';
import { SelectOption } from '@/types/base';

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const fetchAttempts = useRef(0);
  const MAX_ATTEMPTS = 3;

  useEffect(() => {
    // Set up the mount ref
    isMounted.current = true;

    const fetchManufacturers = async () => {
      // Don't retry too many times
      if (fetchAttempts.current >= MAX_ATTEMPTS) {
        console.error('[useFetchManufacturers] ❌ Max retry attempts reached');
        if (isMounted.current) {
          setLoading(false);
          setError('Failed to load manufacturers after multiple attempts');
        }
        return;
      }

      fetchAttempts.current += 1;

      try {
        console.log('[useFetchManufacturers] 🔍 Fetching manufacturers...');

        // API Call
        const response = await fetch('/api/aircraft/manufacturers', {
          method: 'POST', // ✅ Change to POST if required
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch-manufacturers' }), // ✅ Ensure API expects this
        });

        if (!isMounted.current) return;

        // Check for failed request
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[useFetchManufacturers] ❌ API error: ${response.status} - ${errorText}`
          );
          throw new Error(
            `Failed to fetch manufacturers: ${response.statusText}`
          );
        }

        const data = await response.json();

        if (!isMounted.current) return;

        console.log(
          `[useFetchManufacturers] ✅ Fetched ${data.manufacturers?.length || 0} manufacturers`
        );
        setManufacturers(data.manufacturers || []);
        setError(null);
      } catch (err) {
        if (!isMounted.current) return;

        let errorMessage = 'Unknown error';
        if (err instanceof Error) {
          errorMessage = err.message;
        }

        console.error(
          '[useFetchManufacturers] ❌ Error fetching manufacturers:',
          err
        );

        setError(errorMessage);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchManufacturers();

    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, []);

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
      return data?.data?.icao24List ?? [];
    } catch (error) {
      console.error(
        `[useFetchManufacturers] ❌ Error fetching ICAO24s:`,
        error
      );
      return [];
    }
  };

  return { manufacturers, fetchManufacturerIcao24s, loading, error };
};
