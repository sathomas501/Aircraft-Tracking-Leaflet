import { useState, useEffect, useCallback, useRef } from 'react';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import type { Aircraft } from '@/types/base';


interface UseOpenSkyPollingProps {
    icao24List: string[] | undefined; // ICAO24 codes for polling, undefined if not ready
    onData?: (data: Aircraft[]) => void; // Callback for successfully received data
    onError?: (error: Error) => void; // Callback for handling errors
    onStatusChange?: (status: PollingStatus) => void; // Callback for polling status changes
}

type PollingStatus = 'idle' | 'polling' | 'rate-limited' | 'error';

export function useOpenSkyPolling({
    icao24List,
    onData,
    onError,
    onStatusChange,
}: UseOpenSkyPollingProps) {
    const [status, setStatus] = useState<PollingStatus>('idle');
    const [error, setError] = useState<Error | null>(null);
    const rateLimiter = useRef(
        new PollingRateLimiter({
            requestsPerMinute: 60, // Limit requests to 60 per minute
            requestsPerDay: 1000, // Limit requests to 1000 per day
            minPollingInterval: 5000, // Minimum 5 seconds between requests
            maxPollingInterval: 30000, // Maximum 30 seconds between requests
        })
    ).current;

    const fetchData = useCallback(async () => {
        if (!icao24List || icao24List.length === 0) {
            console.warn('No ICAO24 codes provided for polling.');
            return;
        }

        if (!await rateLimiter.tryAcquire()) {
            setStatus('rate-limited');
            onStatusChange?.('rate-limited');
            return;
        }

        try {
            const response = await fetch('/api/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icao24s: icao24List }),
            });

            if (!response.ok) {
                const errorResponse = await response.text();
                console.error('Polling error response:', errorResponse);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setStatus('polling');
            onStatusChange?.('polling');
            onData?.(data);
            rateLimiter.decreasePollingInterval(); // Decrease interval on success
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Polling failed');
            console.error('Polling fetch error:', error);
            setError(error);
            setStatus('error');
            onStatusChange?.('error');
            onError?.(error);
            rateLimiter.increasePollingInterval(); // Increase interval on error
        }
    }, [icao24List, onData, onError, onStatusChange, rateLimiter]);

    const startPolling = useCallback(() => {
        if (!icao24List || icao24List.length === 0) {
            console.warn('Cannot start polling without ICAO24 codes.');
            return;
        }

        const poll = async () => {
            await fetchData();
            const interval = rateLimiter.getCurrentPollingInterval();
            setTimeout(poll, interval);
        };

        poll(); // Start polling loop
    }, [icao24List, fetchData, rateLimiter]);

    useEffect(() => {
        if (icao24List && icao24List.length > 0) {
            startPolling();
        }
        return () => rateLimiter.reset(); // Reset rate limiter on unmount
    }, [icao24List, startPolling]);

    return { status, error };
}
