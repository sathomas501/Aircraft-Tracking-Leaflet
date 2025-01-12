// lib/hooks/useOpenSkyWebSocket.ts
import { useEffect, useCallback, useRef, useState } from 'react';
import type { Aircraft } from '@/types/base';
import { interpolatePositions } from '@/lib/utils/position-interpolation';
import { aircraftCache } from '@/lib/services/aircraft-cache';

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

interface WebSocketMessage {
    type: 'auth' | 'data' | 'error';
    payload: any;
}

export function useOpenSkyWebSocket(options: UseWebSocketOptions = {}) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttemptsRef = useRef(0);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [error, setError] = useState<Error | null>(null);
    const interpolationFrameRef = useRef<number>();

    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 5000;
    const INTERPOLATION_INTERVAL = 100; // 100ms for smooth updates

    const updateConnectionStatus = useCallback((newStatus: ConnectionStatus) => {
        setStatus(newStatus);
        options.onStatusChange?.(newStatus);
    }, [options]);

    const authenticate = useCallback(() => {
        if (!wsRef.current || !options.credentials) return;
        
        updateConnectionStatus('authenticating');
        wsRef.current.send(JSON.stringify({
            type: 'auth',
            payload: {
                username: options.credentials.username,
                password: options.credentials.password
            }
        }));
    }, [options.credentials, updateConnectionStatus]);

    const startPositionInterpolation = useCallback(() => {
        if (interpolationFrameRef.current) {
            cancelAnimationFrame(interpolationFrameRef.current);
        }

        let lastUpdate = Date.now();

        const interpolate = () => {
            const now = Date.now();
            const deltaTime = now - lastUpdate;
            lastUpdate = now;

            const cachedData = aircraftCache.getLatestData();
            if (cachedData && cachedData.aircraft.length > 0) {
                const interpolated = interpolatePositions(cachedData.aircraft, deltaTime);
                options.onData?.(interpolated);
            }

            interpolationFrameRef.current = requestAnimationFrame(interpolate);
        };

        interpolationFrameRef.current = requestAnimationFrame(interpolate);
    }, [options]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            updateConnectionStatus('connecting');

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/opensky`;
            
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected');
                reconnectAttemptsRef.current = 0;
                
                if (options.credentials) {
                    authenticate();
                } else {
                    updateConnectionStatus('connected');
                    startPositionInterpolation();
                }
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    
                    switch (message.type) {
                        case 'auth':
                            if (message.payload.success) {
                                updateConnectionStatus('connected');
                                startPositionInterpolation();
                            } else {
                                throw new Error(message.payload.error || 'Authentication failed');
                            }
                            break;

                        case 'data':
                            aircraftCache.updateFromWebSocket(message.payload);
                            break;

                        case 'error':
                            throw new Error(message.payload);
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                    setError(error instanceof Error ? error : new Error('Message processing failed'));
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setError(new Error('WebSocket connection error'));
                updateConnectionStatus('error');
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket closed');
                updateConnectionStatus('disconnected');
                scheduleReconnect();
            };

        } catch (error) {
            console.error('Error creating WebSocket:', error);
            setError(error instanceof Error ? error : new Error('Failed to create WebSocket'));
            updateConnectionStatus('error');
        }
    }, [options, authenticate, updateConnectionStatus, startPositionInterpolation]);

    const scheduleReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('Max reconnection attempts reached');
            return;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            console.log(`Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
            connect();
        }, RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current));
    }, [connect]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        if (interpolationFrameRef.current) {
            cancelAnimationFrame(interpolationFrameRef.current);
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        updateConnectionStatus('disconnected');
    }, [updateConnectionStatus]);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        status,
        error,
        disconnect,
        reconnect: connect,
        isAuthenticated: status === 'connected' && options.credentials !== undefined
    };
}