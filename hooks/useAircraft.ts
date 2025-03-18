import { useState, useCallback } from 'react';
import { Aircraft } from '@/types/base';

export const useAircraft = () => {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // ✅ Manual Fetch Function (No Auto Polling)
  const fetchAircraft = useCallback(async (icao24s: string[]) => {
    if (!icao24s || icao24s.length === 0) {
      setError('No ICAO24 codes provided.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useAircraft] 🔍 Fetching aircraft data...');
      const response = await fetch('/api/aircraft/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source-Module': 'useAircraft',
        },
        body: JSON.stringify({ icao24s }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch aircraft: ${response.statusText}`);
      }

      const data = await response.json();
      setAircraft(data.aircraft || []);
      setLastFetched(Date.now()); // ✅ Track last fetch time
      setError(null);
    } catch (err) {
      console.error('[useAircraft] ❌ Error fetching aircraft:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { aircraft, loading, error, lastFetched, fetchAircraft };
};
