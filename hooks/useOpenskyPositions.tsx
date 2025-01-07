import { useState, useEffect } from 'react';
import { OpenSkyService, type PositionData } from './../pages/api/opensky';
import { chunk } from 'lodash';

const BATCH_SIZE = 100;

export const useOpenskyPositions = (manufacturer: string) => {
  const [positions, setPositions] = useState<PositionData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!manufacturer) {
      setPositions({});
      return;
    }

    setIsLoading(true);
    const openSkyService = new OpenSkyService(process.env.OPENSKY_USERNAME || '', process.env.OPENSKY_PASSWORD || '');

    const setupSubscription = async () => {
      try {
        // Initial position fetch
        const data = await openSkyService.fetchPositions();
        setPositions(data);

        // Subscribe to updates
        const cleanup = openSkyService.onPositionUpdate((newPositions) => {
          setPositions(prev => ({ ...prev, ...newPositions }));
        });

        return () => {
          cleanup();
          openSkyService.disconnect();
        };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch aircraft data'));
      } finally {
        setIsLoading(false);
      }
    };

    setupSubscription();
  }, [manufacturer]);

  return { positions, isLoading, error };
};