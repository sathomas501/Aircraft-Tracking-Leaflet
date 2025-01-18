import WebSocket from 'ws';
import type { PositionData } from '@/types/base';
import type { ExtendedAircraft } from '@/types/opensky';
import type { IOpenSkyService } from '@/lib/services/IOpenSkyServices';
import axios from 'axios';

export class OpenSkyManager implements IOpenSkyService {
    private static instance: OpenSkyManager;
    private clients: Set<WebSocket> = new Set();
    private cache: Map<string, PositionData> = new Map();
    private subscribers: Set<(data: ExtendedAircraft[]) => void> = new Set();

    private constructor() {}

    public static getInstance(): OpenSkyManager {
        if (!OpenSkyManager.instance) {
            OpenSkyManager.instance = new OpenSkyManager();
        }
        return OpenSkyManager.instance;
    }

    public getAuthStatus(): { authenticated: boolean; username: string | null } {
        return { authenticated: true, username: 'OpenSkyUser' };
    }

    public addClient(client: WebSocket): void {
        this.clients.add(client);
        console.log('[DEBUG] Client added');
    }

    public removeClient(client: WebSocket): void {
        this.clients.delete(client);
        console.log('[DEBUG] Client removed');
    }

    public async fetchPositions(icao24List: string[]): Promise<PositionData[]> {
        const baseUrl = 'https://opensky-network.org/api/states/all';
    
        try {
            const response = await axios.get(baseUrl);
            const aircraftStates = response.data.states;
    
            // Filter for aircraft in the provided ICAO24 list
            const activeAircraft = aircraftStates.filter((state: any) => {
                const isInList = icao24List.includes(state[0]);
                const isAirborne = state[8] === false; // on_ground = false
                const hasValidPosition = state[5] !== null && state[6] !== null; // latitude and longitude
                const isRecentlyUpdated = Date.now() / 1000 - state[4] < 7200; // last_contact within 60 seconds
    
                return isInList && isAirborne && hasValidPosition && isRecentlyUpdated;
            });
    
            // Map the filtered results to PositionData format
            return activeAircraft.map((state: any) => ({
                icao24: state[0],
                latitude: state[6],
                longitude: state[5],
                altitude: state[7],
                heading: state[10],
                velocity: state[9],
                on_ground: state[8],
                last_contact: state[4],
            }));
        } catch (error) {
            console.error('[ERROR] Failed to fetch positions:', error);
            throw new Error('Unable to fetch positions from OpenSky');
        }
    }
    
    

    public async getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]> {
        console.log('[DEBUG] Fetching aircraft details');
        return icao24List.map((icao24) => ({
            icao24,
            manufacturer: 'Unknown',
            model: 'Unknown',
            altitude: 30000,
            heading: 90,
            latitude: 52.0,
            longitude: 13.0,
            velocity: 500,
            vertical_rate: 0,
            squawk: null,
            spi: false,
            on_ground: false,
            last_contact: Date.now(),
            "N-NUMBER": 'N/A',
            NAME: 'Unknown',
            CITY: 'Unknown',
            STATE: 'Unknown',
            isTracked: false,
        }));
    }

    public subscribe(callback: (data: ExtendedAircraft[]) => void): () => void {
        this.subscribers.add(callback);
        console.log('[DEBUG] Subscribed to updates');
        return () => {
            this.subscribers.delete(callback);
            console.log('[DEBUG] Unsubscribed from updates');
        };
    }

    public async getPositions(): Promise<PositionData[]> {
        console.log('[DEBUG] Fetching all positions from cache');
        return Array.from(this.cache.values());
    }

    public async getPositionsMap(): Promise<Map<string, PositionData>> {
        console.log('[DEBUG] Returning positions map');
        return this.cache;
    }

    public async cleanup(): Promise<void> {
        console.log('[DEBUG] Cleaning up resources');
        this.clients.forEach((client) => client.terminate());
        this.clients.clear();
        this.cache.clear();
    }
}