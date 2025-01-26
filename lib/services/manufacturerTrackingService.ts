// lib/services/manufacturerTrackingService.ts
import { getActiveDb } from '@/lib/db/databaseManager';
import { OpenSkyManager } from '@/lib/services/openSkyService';
import { CacheManager } from '@/lib/services/managers/cache-manager';
import type { PositionData } from '@/types/base';
import WebSocket from 'ws';

export class ManufacturerTrackingService {
    private static instance: ManufacturerTrackingService;
    private cache: CacheManager<PositionData[]> = new CacheManager<PositionData[]>(60);
    private currentManufacturer: string | null = null;
    private ws: WebSocket | null = null;
    private currentPositions: Map<string, PositionData> = new Map();
    private wsReconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;

    private constructor() {
        this.setupWebSocket();
    }

    public static getInstance(): ManufacturerTrackingService {
        if (!ManufacturerTrackingService.instance) {
            ManufacturerTrackingService.instance = new ManufacturerTrackingService();
        }
        return ManufacturerTrackingService.instance;
    }

    private setupWebSocket(): void {
        if (this.ws) {
            this.ws.close();
        }

        // Get your OpenSky credentials from environment variables
        const username = process.env.OPENSKY_USERNAME;
        const password = process.env.OPENSKY_PASSWORD;
        const auth = Buffer.from(`${username}:${password}`).toString('base64');

        this.ws = new WebSocket('wss://opensky-network.org/api/states/all/ws', {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        this.ws.on('open', () => {
            console.log('[WebSocket] Connected to OpenSky Network');
            this.wsReconnectAttempts = 0;
        });

        this.ws.on('message', (data: WebSocket.Data) => {
            try {
                const states = JSON.parse(data.toString());
                if (states && states.states) {
                    this.updatePositions(states.states);
                }
            } catch (error) {
                console.error('[WebSocket] Error processing message:', error);
            }
        });

        this.ws.on('close', () => {
            console.log('[WebSocket] Connection closed');
            this.handleReconnect();
        });

        this.ws.on('error', (error) => {
            console.error('[WebSocket] Error:', error);
            this.handleReconnect();
        });
    }

    private handleReconnect(): void {
        if (this.wsReconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.wsReconnectAttempts++;
            console.log(`[WebSocket] Attempting to reconnect (${this.wsReconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => this.setupWebSocket(), 5000 * this.wsReconnectAttempts);
        } else {
            console.error('[WebSocket] Max reconnection attempts reached');
        }
    }

    private updatePositions(states: any[]): void {
        const currentTimestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp
        states.forEach(state => {
            if (state && state[0]) { // state[0] is icao24
                const position: PositionData = {
                    icao24: state[0],
                    latitude: state[6],
                    longitude: state[5],
                    altitude: state[7],
                    velocity: state[9],
                    heading: state[10],
                    on_ground: state[8],
                    last_contact: state[4] || currentTimestamp // OpenSky timestamp or current time
                };
                this.currentPositions.set(position.icao24, position);
            }
        });
    }

    public async startTracking(manufacturer: string): Promise<void> {
        if (this.currentManufacturer !== manufacturer) {
            console.log(`[DEBUG] Switching to manufacturer: ${manufacturer}`);
            this.currentManufacturer = manufacturer;
            this.cache.flush();
            this.currentPositions.clear();

            // Ensure WebSocket connection is active
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.setupWebSocket();
            }
        } else {
            console.log(`[DEBUG] Already tracking manufacturer: ${manufacturer}`);
        }
    }

    public async getActiveAircraft(icao24List: string[]): Promise<PositionData[]> {
        if (!icao24List.length) {
            console.warn(`[WARN] No ICAO24 identifiers provided`);
            return [];
        }

        console.log(`[DEBUG] Fetching positions for ${icao24List.length} aircraft`);
        
        // Get positions from WebSocket data
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const positions: PositionData[] = icao24List
            .map(icao => {
                const pos = this.currentPositions.get(icao);
                if (pos) {
                    // Ensure last_contact is present
                    return {
                        ...pos,
                        last_contact: pos.last_contact || currentTimestamp
                    };
                }
                return undefined;
            })
            .filter((pos): pos is PositionData => pos !== undefined);

        console.log(`[DEBUG] Found ${positions.length} active aircraft positions`);
        return positions;
    }

    public async stopTracking(): Promise<void> {
        if (this.currentManufacturer) {
            console.log(`[DEBUG] Stopping tracking for manufacturer: ${this.currentManufacturer}`);
            this.currentManufacturer = null;
            this.cache.flush();
            this.currentPositions.clear();
        }
    }

    public cleanup(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.currentPositions.clear();
        this.cache.flush();
    }
}