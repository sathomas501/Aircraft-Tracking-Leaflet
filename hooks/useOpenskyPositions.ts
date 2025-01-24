import { useState, useCallback, useRef, useEffect } from 'react';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import type { PositionData } from '@/types/base';

interface UseOpenSkyPositionsProps {
    pollInterval?: number;
    icao24s?: string[];
    manufacturer?: string;
    onError?: (error: Error) => void;
}

type PollingStatus = 'idle' | 'polling' | 'error';

export function useOpenSkyPositions({
    pollInterval = 15000,
    icao24s = [],
    manufacturer,
    onError,
}: UseOpenSkyPositionsProps = {}) {
    const [positions, setPositions] = useState<Record<string, PositionData>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [status, setStatus] = useState<PollingStatus>('idle');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPositions = useCallback(async () => {
        try {
            const response = await fetch('/api/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icao24s, manufacturer }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: PositionData[] = await response.json();
            const updated = data.reduce((acc, aircraft) => {
                acc[aircraft.icao24] = {
                    ...aircraft,
                    last_seen: Date.now()
                };
                return acc;
            }, {} as Record<string, PositionData>);

            setPositions(updated);
            setStatus('polling');
            setIsLoading(false);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch positions');
            setError(error);
            setStatus('error');
            setIsLoading(false);
            onError?.(error);
            errorHandler.handleError(ErrorType.POLLING, error);
        }
    }, [icao24s, manufacturer, onError]);

    useEffect(() => {
        const poll = async () => {
            await fetchPositions();
            timeoutRef.current = setTimeout(poll, pollInterval);
        };

        poll();

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [fetchPositions, pollInterval]);

    const stopPolling = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setStatus('idle');
    }, []);

    return {
        positions,
        isLoading,
        error,
        status,
        stopPolling,
        startPolling: fetchPositions
    };
}