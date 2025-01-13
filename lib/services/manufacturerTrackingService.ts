// lib/services/manufacturerTrackingService.ts
import { openSkyService } from '@/lib/api/opensky';
import { getDb } from '@/lib/db/connection';
import { getActiveDb } from '@/lib/db/activeConnection';
import type { PositionData } from '@/types/api/opensky';

export class ManufacturerTrackingService {
    private static instance: ManufacturerTrackingService;
    private currentManufacturer: string | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private icao24List: string[] = [];
    private wsSubscribed = false;
    private positionUpdateCallback: ((positions: PositionData[]) => Promise<void>) | null = null;
    
    private readonly UPDATE_INTERVAL = 15000; // 15 seconds

    private constructor() {}

    public static getInstance(): ManufacturerTrackingService {
        if (!this.instance) {
            this.instance = new ManufacturerTrackingService();
        }
        return this.instance;
    }

    public async startTracking(manufacturer: string): Promise<void> {
        // Stop tracking previous manufacturer if any
        await this.stopTracking();

        this.currentManufacturer = manufacturer;
        
        // Get all icao24s for this manufacturer
        const mainDb = await getDb();
        const aircraft = await mainDb.all<{ icao24: string }[]>(`
            SELECT icao24
            FROM aircraft
            WHERE 
                manufacturer = ?
                AND icao24 IS NOT NULL
                AND LENGTH(TRIM(icao24)) > 0
        `, [manufacturer]);

        this.icao24List = aircraft.map(a => a.icao24);

        // Start periodic updates
        this.startPeriodicUpdates();
        
        // Subscribe to WebSocket updates
        await this.subscribeToWebSocket();

        // Do initial update
        await this.updatePositions();
    }

    public async stopTracking(): Promise<void> {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.wsSubscribed && this.positionUpdateCallback) {
            openSkyService.unsubscribeFromAircraft(this.icao24List);
            openSkyService.removePositionUpdateCallback(this.positionUpdateCallback);
            this.wsSubscribed = false;
            this.positionUpdateCallback = null;
        }

        this.currentManufacturer = null;
        this.icao24List = [];
    }

    private startPeriodicUpdates(): void {
        this.updateInterval = setInterval(() => {
            this.updatePositions().catch(error => {
                console.error('Error updating positions:', error);
            });
        }, this.UPDATE_INTERVAL);
    }

    private async subscribeToWebSocket(): Promise<void> {
        if (this.icao24List.length === 0) return;

        try {
            await openSkyService.subscribeToAircraft(this.icao24List);
            this.wsSubscribed = true;

            // Create and store the callback
            this.positionUpdateCallback = async (positions: PositionData[]) => {
                if (this.currentManufacturer) {
                    await this.updateActiveDatabase(positions);
                }
            };

            // Register the callback
            openSkyService.onPositionUpdate(this.positionUpdateCallback);

        } catch (error) {
            console.error('Failed to subscribe to WebSocket updates:', error);
        }
    }

    private async updatePositions(): Promise<void> {
        if (!this.currentManufacturer || this.icao24List.length === 0) return;

        try {
            const positions = await openSkyService.getPositions(this.icao24List);
            await this.updateActiveDatabase(positions);
        } catch (error) {
            console.error('Error updating positions:', error);
        }
    }

    private async updateActiveDatabase(positions: PositionData[]): Promise<void> {
        // ... rest of the implementation remains the same ...
    }

    public getCurrentManufacturer(): string | null {
        return this.currentManufacturer;
    }

    public isTracking(): boolean {
        return this.currentManufacturer !== null;
    }

    public async cleanup(): Promise<void> {
        await this.stopTracking();
    }
}