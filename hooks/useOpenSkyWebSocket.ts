import { useEffect, useCallback, useRef, useState } from 'react';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { ExtendedAircraft } from '@/lib/services/opensky-integrated';

export type PollingStatus = 'idle' | 'polling' | 'rate-limited' | 'error';

interface UsePollingOptions {
    onData?: (data: ExtendedAircraft[]) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: PollingStatus) => void;
    icao24List?: string[];
    manufacturer?: string;
    interpolate?: boolean;
}

const rateLimiter = new PollingRateLimiter({
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    minPollingInterval: 5000,
    maxPollingInterval: 30000
});

export function useOpenSkyPolling({
    onData,
    onError,
    onStatusChange,
    icao24List = [],
    manufacturer,
    interpolate = true,
}: UsePollingOptions = {}) {
    const [status, setStatus] = useState<PollingStatus>('idle');
    const [error, setError] = useState<Error | null>(null);
    const pollingTimeoutRef = useRef<NodeJS.Timeout>();
    const interpolationFrameRef = useRef<number>();
    const lastUpdateRef = useRef<number>(Date.now());
    const currentAircraftRef = useRef<ExtendedAircraft[]>([]);

    const updateData = useCallback((data: ExtendedAircraft[]) => {
        currentAircraftRef.current = data;
        lastUpdateRef.current = Date.now();
        onData?.(data);
    }, [onData]);

    const interpolatePositions = useCallback(() => {
        if (!interpolate || !currentAircraftRef.current.length) return;

        const now = Date.now();
        const deltaTime = (now - lastUpdateRef.current) / 1000;
        
        const interpolated = currentAircraftRef.current.map(aircraft => {
            if (!aircraft.velocity || !aircraft.heading) return aircraft;

            const distance = (aircraft.velocity * deltaTime) / 3600;
            const headingRad = (aircraft.heading * Math.PI) / 180;

            return {
                ...aircraft,
                latitude: aircraft.latitude + distance * Math.cos(headingRad),
                longitude: aircraft.longitude + distance * Math.sin(headingRad)
            };
        });

        onData?.(interpolated);
        interpolationFrameRef.current = requestAnimationFrame(interpolatePositions);
    }, [interpolate, onData]);

    const fetchData = useCallback(async () => {
        if (!await rateLimiter.tryAcquire()) {
            setStatus('rate-limited');
            onStatusChange?.('rate-limited');
            return;
        }

        try {
            const response = await fetch('/api/aircraft/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    icao24List,
                    manufacturer 
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            updateData(data);
            rateLimiter.decreasePollingInterval();
            setStatus('polling');
            onStatusChange?.('polling');

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Polling failed');
            console.error('[OpenSky] Polling error:', error);
            errorHandler.handleError(ErrorType.POLLING, error);
            setError(error);
            setStatus('error');
            onStatusChange?.('error');
            onError?.(error);
            rateLimiter.increasePollingInterval();
        }
    }, [icao24List, manufacturer, onStatusChange, onError, updateData]);

    const startPolling = useCallback(() => {
        const poll = async () => {
            await fetchData();
            const interval = rateLimiter.getCurrentPollingInterval();
            pollingTimeoutRef.current = setTimeout(poll, interval);
        };

        if (interpolate) {
            interpolationFrameRef.current = requestAnimationFrame(interpolatePositions);
        }

        poll();
    }, [fetchData, interpolate, interpolatePositions]);

    const stopPolling = useCallback(() => {
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
        }
        if (interpolationFrameRef.current) {
            cancelAnimationFrame(interpolationFrameRef.current);
        }
        setStatus('idle');
        onStatusChange?.('idle');
    }, [onStatusChange]);

    useEffect(() => {
        startPolling();
        return stopPolling;
    }, [startPolling, stopPolling]);

    return {
        status,
        error,
        pollingInterval: rateLimiter.getCurrentPollingInterval(),
        stop: stopPolling,
        start: startPolling,
    };
}