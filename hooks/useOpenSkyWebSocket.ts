import { useEffect, useCallback, useRef, useState } from 'react';
import { OpenSkyWebSocket } from '@/lib/services/openSkyService';
import { ExtendedAircraft } from '@/lib/services/opensky-integrated';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketOptions {
    onData?: (data: ExtendedAircraft[]) => void;
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
    const serviceRef = useRef<OpenSkyWebSocket | null>(null);
    const interpolationFrameRef = useRef<number>();
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [error, setError] = useState<Error | null>(null);

    const lastUpdateRef = useRef<number>(Date.now());
    const currentAircraftRef = useRef<ExtendedAircraft[]>([]);

    const updateFromWebSocket = useCallback((data: ExtendedAircraft[]) => {
        currentAircraftRef.current = data;
        lastUpdateRef.current = Date.now();

        if (onData) {
            onData(data);
        }
    }, [onData]);

    const interpolatePositions = useCallback(() => {
        if (!interpolate || !currentAircraftRef.current.length) return;

        const now = Date.now();
        const deltaTime = (now - lastUpdateRef.current) / 1000;

        const interpolated = currentAircraftRef.current.map((aircraft) => {
            if (!aircraft.velocity || !aircraft.heading) return aircraft;

            const distance = (aircraft.velocity * deltaTime) / 3600;
            const headingRad = (aircraft.heading * Math.PI) / 180;

            return {
                ...aircraft,
                latitude: aircraft.latitude + distance * Math.cos(headingRad),
                longitude: aircraft.longitude + distance * Math.sin(headingRad)
            };
        });

        if (onData) {
            onData(interpolated);
        }

        interpolationFrameRef.current = requestAnimationFrame(interpolatePositions);
    }, [interpolate, onData]);

    // Connection setup
const setupConnection = useCallback(() => {
    if (typeof window === 'undefined') return () => {};
    
    let cleanup = () => {};
    
    try {
        // Create new instance if needed
        if (!serviceRef.current) {
            serviceRef.current = new OpenSkyWebSocket();
        }

        const service = serviceRef.current;
        setStatus('connecting');
        onStatusChange?.('connecting');

        // Authentication check using instance method
        const authStatus = service.getAuthStatus();
        if (!authStatus) {
            throw new Error('WebSocket authentication failed');
        }

        // Connect and subscribe
        service.connect();
        
        const topic = manufacturer 
            ? `manufacturer/${manufacturer}`
            : `aircraft/${icao24List.join(',')}`;
            
        // Use instance method to subscribe
        service.subscribe(topic, (data: ExtendedAircraft[]) => {
            updateFromWebSocket(data);
        });

        // Initial data fetch
        if (icao24List.length > 0) {
            service.getAircraft(icao24List)
                .then(updateFromWebSocket)
                .catch((err) => {
                    console.error('Error fetching initial aircraft data:', err);
                    onError?.(err);
                });
        }

        setStatus('connected');
        onStatusChange?.('connected');

        if (interpolate) {
            interpolationFrameRef.current = requestAnimationFrame(interpolatePositions);
        }

        cleanup = () => {
            if (serviceRef.current) {
                serviceRef.current.unsubscribe(topic);
                serviceRef.current.cleanup();
                serviceRef.current = null;
            }
            if (interpolationFrameRef.current) {
                cancelAnimationFrame(interpolationFrameRef.current);
            }
            setStatus('disconnected');
            onStatusChange?.('disconnected');
        };

    } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to setup connection');
        console.error('[OpenSky] Connection error:', error);
        setError(error);
        setStatus('error');
        onStatusChange?.('error');
        onError?.(error);
    }

    return cleanup;
}, [icao24List, manufacturer, interpolate, interpolatePositions, onStatusChange, onError, updateFromWebSocket]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const cleanup = setupConnection();
        return cleanup;
    }, [setupConnection]);

    return {
        status,
        error,
        disconnect: useCallback(() => {
            if (serviceRef.current) {
                serviceRef.current.cleanup();
                setStatus('disconnected');
            }
        }, []),
        reconnect: useCallback(() => {
            if (status === 'disconnected' || status === 'error') {
                setupConnection();
            }
        }, [status, setupConnection]),
    };
}