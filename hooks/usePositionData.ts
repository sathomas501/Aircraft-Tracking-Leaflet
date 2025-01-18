// hooks/usePositionData.ts
import { useState, useCallback, useRef } from 'react';
import { fetchAircraftPositions } from '@/utils/aircraftServices';
import type { PositionData } from '@/types/base';

const CACHE_DURATION = 30_000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface CacheEntry {
  data: PositionData[];
  timestamp: number;
}

interface UsePositionDataReturn {
  positions: PositionData[];
  loading: boolean;
  error: string | null;
  fetchPositions: (manufacturer: string) => Promise<void>;
  clearCache: () => void;
}

export function usePositionData(): UsePositionDataReturn {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Record<string, CacheEntry>>({});

  const clearCache = useCallback(() => {
    cache.current = {};
  }, []);

  const fetchWithRetry = async (
    manufacturer: string, 
    retryCount = 0
  ): Promise<PositionData[]> => {
    try {
      return await fetchAircraftPositions([manufacturer]);
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return fetchWithRetry(manufacturer, retryCount + 1);
      }
      throw error;
    }
  };

  const fetchPositions = useCallback(async (manufacturer: string) => {
    setError(null);
    setLoading(true);

    try {
      // Check cache
      const cached = cache.current[manufacturer];
      const now = Date.now();

      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        setPositions(cached.data);
        setLoading(false);
        return;
      }

      const data = await fetchWithRetry(manufacturer);
      
      // Update cache
      cache.current[manufacturer] = {
        data,
        timestamp: now
      };

      setPositions(data);
    } catch (error) {
      setError('Failed to fetch aircraft positions. Please try again.');
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    positions,
    loading,
    error,
    fetchPositions,
    clearCache
  };
}