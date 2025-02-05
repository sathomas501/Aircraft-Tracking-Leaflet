//components/aircraft/customHooks/useAircraftData

// useAircraftData.ts
import { useState, useEffect } from 'react';
import { trackManufacturer } from '../selector/services/aircraftService';

interface AircraftData {
  activeCount: number;
  loading: boolean;
  error: Error | null;
}

export const useAircraftData = (manufacturer: string): AircraftData => {
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!manufacturer) {
      setActiveCount(0);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await trackManufacturer(manufacturer);
        setActiveCount(result.liveAircraft.length);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [manufacturer]);

  return { activeCount, loading, error };
};
