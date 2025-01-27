import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';
import { fetchLiveData } from '../services/fetch-Live-Data';

export class OpenSkySyncService {
    private static instance: OpenSkySyncService;
    private syncInterval: NodeJS.Timeout | null = null;
    private syncIntervalTime = 5 * 60 * 1000; // 5 minutes

    private constructor() {}

    public static getInstance(): OpenSkySyncService {
        if (!OpenSkySyncService.instance) {
            OpenSkySyncService.instance = new OpenSkySyncService();
        }
        return OpenSkySyncService.instance;
    }

    public startSyncing(): void {
        if (!this.syncInterval) {
            this.syncInterval = setInterval(() => this.syncStaleAircraft(), this.syncIntervalTime);
        }
    }

    public stopSyncing(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    private async syncStaleAircraft(): Promise<void> {
        const dbManager = TrackingDatabaseManager.getInstance();
        await dbManager.initialize();

        const staleAircraft: { icao24: string }[] = await dbManager.getStaleAircraft();
        const icao24List = staleAircraft.map((a: { icao24: string }) => a.icao24);

        if (icao24List.length > 0) {
            await fetchLiveData(icao24List);
        }
    }
}
