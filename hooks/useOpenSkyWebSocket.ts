import { useEffect, useCallback, useRef, useState } from 'react';

interface Aircraft {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    velocity?: number;
    heading?: number;
    model?: string; // Optional, provide a fallback where needed
}

interface CachedRegionData {
    description: string;
    aircraft: Aircraft[];
}

interface UseWebSocketOptions {
    onData?: (data: Aircraft[]) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
    credentials?: {
        username: string;
        password: string;
    };
}

export type ConnectionStatus =
    | 'disconnected'
    | 'connecting'
    | 'authenticating'
    | 'connected'
    | 'error';

export function useOpenSkyWebSocket(options: UseWebSocketOptions = {}) {
    const wsRef = useRef<WebSocket | null>(null);
    const interpolationFrameRef = useRef<number>();
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [error, setError] = useState<Error | null>(null);

    // Internal caching logic
    const cache = useRef<Map<string, Aircraft>>(new Map());
    const regionData = useRef<Map<string, CachedRegionData>>(new Map());

    const updateFromWebSocket = useCallback((data: Aircraft[]) => {
        data.forEach((aircraft) => {
            cache.current.set(aircraft.icao24, aircraft);
        });
    }, []);

    const getLatestData = useCallback(() => {
        return { aircraft: Array.from(cache.current.values()) };
    }, []);

    const startPositionInterpolation = useCallback(() => {
        if (interpolationFrameRef.current) {
            cancelAnimationFrame(interpolationFrameRef.current);
        }

        let lastUpdate = Date.now();

        const interpolate = () => {
            const now = Date.now();
            const deltaTime = now - lastUpdate;
            lastUpdate = now;

            const cachedData = getLatestData();
            if (cachedData && cachedData.aircraft.length > 0) {
                const interpolated = cachedData.aircraft.map((aircraft) => ({
                    ...aircraft,
                    model: aircraft.model || 'Unknown', // Ensure model is a string
                }));
                options.onData?.(interpolated);
            }

            interpolationFrameRef.current = requestAnimationFrame(interpolate);
        };

        interpolationFrameRef.current = requestAnimationFrame(interpolate);
    }, [getLatestData, options]);

    // Additional WebSocket logic here...

    return {
        status,
        error,
        disconnect: () => {}, // Define disconnect logic
        reconnect: () => {}, // Define reconnect logic
        isAuthenticated: status === 'connected' && !!options.credentials,
    };
}
