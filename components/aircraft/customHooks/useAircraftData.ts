import { useState, useEffect, useCallback } from 'react';
import { useFetchManufacturers } from './useFetchManufactures'; // ✅ Correct import
import { trackManufacturer } from '../selector/services/aircraftService'; // ✅ Use correct API

interface AircraftData {
  activeCount: number;
  liveAircraft: string[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export const useAircraftData = () => {
  const { manufacturers } = useFetchManufacturers(); // ✅ Use manufacturers from hook
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [activeCount, setActiveCount] = useState(0);
  const [liveAircraft, setLiveAircraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [prevManufacturer, setPrevManufacturer] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedManufacturer || selectedManufacturer === prevManufacturer)
      return;

    setLoading(true);
    setError(null);
    setPrevManufacturer(selectedManufacturer);

    try {
      console.log(
        `📡 Fetching ICAO24s for manufacturer: ${selectedManufacturer}`
      );
      const result = await trackManufacturer(selectedManufacturer); // ✅ Correct function call

      setActiveCount(result.liveAircraft.length);
      setLiveAircraft(result.liveAircraft);
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
    manufacturers, // ✅ Provide manufacturer list
    selectedManufacturer,
    setSelectedManufacturer, // ✅ Allow selection from UI
    activeCount,
    liveAircraft,
    loading,
    error,
    reload: fetchData,
  };
};
