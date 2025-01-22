import { useState, useCallback, useRef, useEffect } from 'react';
import { useOpenSkyWebSocket, ConnectionStatus } from './useOpenSkyWebSocket';

interface PositionData {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    velocity?: number;
    heading?: number;
    lastUpdate: number;
    manufacturer?: string;
}

interface UseOpenSkyPositionsProps {
    pollInterval?: number;
    icao24s?: string[];
    manufacturer?: string;
    useWebSocket?: boolean;
}

export function useOpenSkyPositions({
    pollInterval = 15000,
    icao24s = [],
    manufacturer,
    useWebSocket = true,
}: UseOpenSkyPositionsProps = {}) {
    const [positions, setPositions] = useState<Record<string, PositionData>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

    const fetchPositions = useCallback(async () => {
        try {
            const response = await fetch('/api/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icao24s, manufacturer }),
            });
            const data: PositionData[] = await response.json();

            const updated = data.reduce((acc, aircraft) => {
                acc[aircraft.icao24] = aircraft;
                return acc;
            }, {} as Record<string, PositionData>);

            setPositions(updated);
            setIsLoading(false);
        } catch (err) {
            console.error('[Polling] Fetch error:', err);
            setError(err instanceof Error ? err : new Error('Failed to fetch positions'));
            setIsLoading(false);
        }
    }, [icao24s, manufacturer]);

    const ws = useWebSocket
    ? useOpenSkyWebSocket({
          icao24List: icao24s,
          manufacturer,
          onData: (aircraftData) => {
              const updated = aircraftData.reduce((acc, aircraft) => {
                  // Use last_contact from the aircraft data as lastUpdate
                  acc[aircraft.icao24] = {
                      ...aircraft,
                      lastUpdate: aircraft.last_contact * 1000 // Convert to milliseconds if needed
                  };
                  return acc;
              }, {} as Record<string, PositionData>);
              setPositions(updated);
              setIsLoading(false);
          },
          onError: setError,
          onStatusChange: setConnectionStatus,
      })
    : null;

    useEffect(() => {
        if (connectionStatus === 'connected' || !useWebSocket) return;

        const poll = async () => {
            await fetchPositions();
            timeoutRef.current = setTimeout(poll, pollInterval);
        };

        poll();

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [fetchPositions, pollInterval, useWebSocket, connectionStatus]);

    return { positions, isLoading, error, connectionStatus };
}
