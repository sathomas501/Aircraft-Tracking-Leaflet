import { useEffect, useCallback, useRef, useState } from 'react';

// Define types for aircraft and connection status
interface Aircraft {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    velocity?: number;
    heading?: number;
    model?: string;
    manufacturer?: string;
    lastUpdate: number;
}

interface CachedRegionData {
    description: string;
    aircraft: Aircraft[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketOptions {
    onData?: (data: Aircraft[]) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
    icao24List?: string[];
    manufacturer?: string;
    interpolate?: boolean;
}

export function useOpenSkyWebSocket({
    onData,
    onError,
    onStatusChange,
    icao24List = [],
    manufacturer,
    interpolate = true,
}: UseWebSocketOptions = {}) {
    const wsRef = useRef<WebSocket | null>(null);
    const interpolationFrameRef = useRef<number>();
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [error, setError] = useState<Error | null>(null);

    // Internal caching logic
    const cache = useRef<Map<string, Aircraft>>(new Map());

    // Update aircraft data from WebSocket messages
    const updateFromWebSocket = useCallback((data: Aircraft[]) => {
        const timestamp = Date.now();

        data.forEach((aircraft) => {
            if (aircraft.icao24) {
                cache.current.set(aircraft.icao24, { ...aircraft, lastUpdate: timestamp });
            }
        });

        if (onData) {
            onData(data);
        }
    }, [onData]);

    // Interpolate aircraft positions based on velocity and heading
    const interpolatePositions = useCallback(() => {
        if (!interpolate) return;

        const now = Date.now();
        const deltaTime = (now - (cache.current.get('lastUpdate')?.lastUpdate ?? now)) / 1000; // seconds

        const interpolated = Array.from(cache.current.values()).map((aircraft) => {
            if (!aircraft.velocity || !aircraft.heading) return aircraft;

            const distance = (aircraft.velocity * deltaTime) / 3600; // Convert to degrees
            const headingRad = (aircraft.heading * Math.PI) / 180;

            return {
                ...aircraft,
                latitude: aircraft.latitude + distance * Math.cos(headingRad),
                longitude: aircraft.longitude + distance * Math.sin(headingRad),
                lastUpdate: now,
            };
        });

        if (onData) {
            onData(interpolated);
        }

        interpolationFrameRef.current = requestAnimationFrame(interpolatePositions);
    }, [interpolate, onData]);

    // Handle WebSocket connection
    const setupWebSocket = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/websocket`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        setStatus('connecting');
        onStatusChange?.('connecting');

        ws.onopen = () => {
            setStatus('connected');
            onStatusChange?.('connected');

            ws.send(JSON.stringify({ type: 'subscribe', data: { icao24List, manufacturer } }));

            if (interpolate) {
                interpolatePositions();
            }
        };

        ws.onmessage = (event) => {
            try {
                const messageData = JSON.parse(event.data);
                updateFromWebSocket(messageData);
            } catch (err) {
                console.error('[WebSocket] Error parsing message:', err);
                setError(new Error('Error parsing WebSocket message'));
                onError?.(err as Error);
            }
        };

        ws.onerror = (err) => {
            console.error('[WebSocket] Error:', err);
            setError(new Error('WebSocket error'));
            setStatus('error');
            onStatusChange?.('error');
        };

        ws.onclose = () => {
            console.warn('[WebSocket] Connection closed');
            setStatus('disconnected');
            onStatusChange?.('disconnected');

            if (interpolationFrameRef.current) {
                cancelAnimationFrame(interpolationFrameRef.current);
            }
        };

        return () => {
            ws.close();
            if (interpolationFrameRef.current) {
                cancelAnimationFrame(interpolationFrameRef.current);
            }
        };
    }, [icao24List, manufacturer, interpolate, interpolatePositions, onStatusChange, onError]);

    // Manage WebSocket connection lifecycle
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const cleanup = setupWebSocket();

        return cleanup;
    }, [setupWebSocket]);

    return {
        status,
        error,
        disconnect: useCallback(() => {
            if (wsRef.current) {
                wsRef.current.close();
                setStatus('disconnected');
            }
        }, []),
        reconnect: useCallback(() => {
            if (wsRef.current?.readyState === WebSocket.CLOSED) {
                setupWebSocket();
            }
        }, [setupWebSocket]),
    };
}
