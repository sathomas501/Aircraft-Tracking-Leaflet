// hooks/useOpenskyPositions.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import type { PositionData } from '@/types/api/opensky';
import { openSkyService } from '@/lib/api/opensky';

interface UseOpenSkyPositionsProps {
  pollInterval?: number;
  icao24s?: string[];
}

export function useOpenSkyPositions({ 
  pollInterval = 15000,
  icao24s 
}: UseOpenSkyPositionsProps = {}) {
  const [positions, setPositions] = useState<Record<string, PositionData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const newPositions = await openSkyService.getPositions(icao24s);
      setPositions(prev => {
        const updatedPositions: Record<string, PositionData> = {};
        newPositions.forEach(pos => {
          if (pos.icao24) {
            updatedPositions[pos.icao24] = pos;
          }
        });
        return updatedPositions;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch positions'));
    } finally {
      setIsLoading(false);
    }
  }, [icao24s]);

  useEffect(() => {
    fetchPositions();
    
    const pollPositions = () => {
      timeoutRef.current = setTimeout(() => {
        fetchPositions().then(() => pollPositions());
      }, pollInterval);
    };

    pollPositions();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchPositions, pollInterval]);

  return { positions, isLoading, error };
}