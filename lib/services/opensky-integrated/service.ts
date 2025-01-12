// lib/services/opensky-integrated/service.ts
import type { OpenSkyService, WebSocketClient } from './types';
import type { Aircraft } from '@/types/base';
import type { WebSocket } from 'ws';
import { WebSocketHandler } from './ws-handler';
import { enhancedCache } from '../enhanced-cache';
import { errorHandler, ErrorType } from '../error-handler';
import { openSkyAuth } from '../opensky-auth';

class OpenSkyServiceImpl implements OpenSkyService {
    private static instance: OpenSkyServiceImpl;
    private wsHandler: WebSocketHandler;
    private subscribers = new Set<(data: Aircraft[]) => void>();
    private authInitialized = false;

    private constructor() {
        this.wsHandler = new WebSocketHandler();
        this.initializeAuth();
    }

    static getInstance(): OpenSkyServiceImpl {
        if (!OpenSkyServiceImpl.instance) {
            OpenSkyServiceImpl.instance = new OpenSkyServiceImpl();
        }
        return OpenSkyServiceImpl.instance;
    }

    private async initializeAuth() {
        if (this.authInitialized) return;
        
        try {
            const isAuthenticated = await openSkyAuth.authenticate();
            if (!isAuthenticated) {
                console.warn('OpenSky running in anonymous mode with limited rate limits');
            } else {
                console.log('OpenSky authenticated successfully');
            }
        } catch (error) {
            console.error('Failed to initialize OpenSky authentication:', error);
        } finally {
            this.authInitialized = true;
        }
    }

    async getAircraft(icao24List: string[]): Promise<Aircraft[]> {
        try {
            // Ensure auth is initialized before making requests
            if (!this.authInitialized) {
                await this.initializeAuth();
            }

            const cachedResults = await Promise.all(
                icao24List.map(async (icao24): Promise<Aircraft | null> => {
                    return enhancedCache.get(icao24);
                })
            );

            return cachedResults.filter((aircraft): aircraft is Aircraft => aircraft !== null);
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to get aircraft data');
            return [];
        }
    }

    subscribe(callback: (data: Aircraft[]) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    addClient(ws: WebSocket): void {
        this.wsHandler.addClient(ws as WebSocketClient);
    }

    removeClient(ws: WebSocket): void {
        this.wsHandler.removeClient(ws as WebSocketClient);
    }

    cleanup(): void {
        this.wsHandler.cleanup();
        this.subscribers.clear();
    }

    getAuthStatus(): { authenticated: boolean; username: string | null } {
        return {
            authenticated: openSkyAuth.isAuthenticated(),
            username: openSkyAuth.getUsername()
        };
    }
}

export const openSkyService: OpenSkyService = OpenSkyServiceImpl.getInstance();