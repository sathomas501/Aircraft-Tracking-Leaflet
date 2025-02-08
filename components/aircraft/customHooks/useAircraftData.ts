import { useState, useEffect } from 'react';
import { trackManufacturer } from '../selector/services/aircraftService';

interface AircraftData {
  activeCount: number;
  liveAircraft: string[]; // ✅ Includes the full list of ICAO24 codes
  loading: boolean;
  error: Error | null;
}

export const useAircraftData = (manufacturer: string): AircraftData => {
  const [activeCount, setActiveCount] = useState(0);
  const [liveAircraft, setLiveAircraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [prevManufacturer, setPrevManufacturer] = useState<string | null>(null); // ✅ Store previous manufacturer

  useEffect(() => {
    if (!manufacturer || manufacturer === prevManufacturer) return; // ✅ Prevent unnecessary API calls

    const controller = new AbortController(); // ✅ Create an AbortController to cancel requests

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setPrevManufacturer(manufacturer); // ✅ Store the latest manufacturer

        const result = await trackManufacturer(manufacturer);
        if (controller.signal.aborted) return; // ✅ Prevent updating state if request is canceled

        setActiveCount(result.liveAircraft.length);
        setLiveAircraft(result.icao24s);
      } catch (err) {
        if (controller.signal.aborted) return; // ✅ Ignore errors if request was canceled
        setError(
          err instanceof Error ? err : new Error('Failed to fetch data')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => controller.abort(); // ✅ Cleanup function: cancels API request if the component unmounts or manufacturer changes
  }, [manufacturer]);

  return { activeCount, liveAircraft, loading, error };
};
