import { useState, useEffect, useCallback } from 'react';
import { trackManufacturer } from '../selector/services/aircraftService';

interface AircraftData {
  activeCount: number;
  liveAircraft: string[]; // ✅ Includes the full list of ICAO24 codes
  loading: boolean;
  error: Error | null;
  reload: () => void; // ✅ Allows manual re-fetching
}

export const useAircraftData = (manufacturer: string): AircraftData => {
  const [activeCount, setActiveCount] = useState(0);
  const [liveAircraft, setLiveAircraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [prevManufacturer, setPrevManufacturer] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!manufacturer || manufacturer === prevManufacturer) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPrevManufacturer(manufacturer);

    try {
      console.log(`📡 Fetching ICAO24s for manufacturer: ${manufacturer}`);
      const result = await trackManufacturer(manufacturer);
      if (controller.signal.aborted) return;

      setActiveCount(result.liveAircraft.length);
      setLiveAircraft(result.icao24s);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [manufacturer, prevManufacturer]);

  useEffect(() => {
    fetchData();
    return () => console.log('🔄 Cleanup: Cancelling API request');
  }, [fetchData]);

  return { activeCount, liveAircraft, loading, error, reload: fetchData };
};
