import { useState, useEffect } from 'react';

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState([]);
  const [icao24s, setIcao24s] = useState<string[]>([]);
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

  const fetchIcao24s = async (manufacturer: string) => {
    if (!manufacturer) return;

    setLoading(true);
    try {
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ICAO24s');
      }

      const { icao24s } = await response.json();
      console.log(`[useFetchManufacturers] ✅ Found ${icao24s.length} ICAO24s`);

      setIcao24s(icao24s);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unknown error fetching ICAO24s'
      );
    } finally {
      setLoading(false);
    }
  };

  return { manufacturers, icao24s, fetchIcao24s, loading, error };
};
