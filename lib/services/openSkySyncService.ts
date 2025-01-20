import { getActiveDb } from '@/lib/db/databaseManager';
import { openSkyService } from '@/lib/services/openSkyService'; // Import the singleton instance
import type { PositionData } from '@/types/base';

export class OpenSkySyncService {
    private static instance: OpenSkySyncService;
    private syncInterval: NodeJS.Timeout | null = null;
    private readonly syncIntervalTime = 15000; // 15 seconds

    private constructor() {
        // Private constructor for singleton
    }

    public static getInstance(): OpenSkySyncService {
        if (!OpenSkySyncService.instance) {
            OpenSkySyncService.instance = new OpenSkySyncService();
        }
        return OpenSkySyncService.instance;
    }

    private async updateActiveAircraft(positions: PositionData[]): Promise<void> {
        const db = await getActiveDb();

        try {
            await db.run('BEGIN TRANSACTION');

            for (const position of positions) {
                if (!position.icao24) continue;

                await db.run(
                    `
                    INSERT INTO active_tracking (
                        icao24,
                        last_contact,
                        latitude,
                        longitude,
                        altitude,
                        velocity,
                        heading,
                        on_ground
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(icao24) DO UPDATE SET
                        last_contact = ?,
                        latitude = ?,
                        longitude = ?,
                        altitude = ?,
                        velocity = ?,
                        heading = ?,
                        on_ground = ?
                `,
                    [
                        position.icao24,
                        position.last_contact,
                        position.latitude,
                        position.longitude,
                        position.altitude,
                        position.velocity,
                        position.heading,
                        position.on_ground,
                        position.last_contact,
                        position.latitude,
                        position.longitude,
                        position.altitude,
                        position.velocity,
                        position.heading,
                        position.on_ground,
                    ]
                );
            }

            // Clean up stale entries (older than 2 hours)
            const staleThreshold = Math.floor(Date.now() / 1000) - 7200;
            await db.run('DELETE FROM active_tracking WHERE last_contact < ?', [staleThreshold]);

            await db.run('COMMIT');
        } catch (error) {
            await db.run('ROLLBACK');
            console.error('Error updating active aircraft:', error);
            throw error;
        }
    }

    public async syncActiveAircraft(): Promise<void> {
        try {
            const db = await getActiveDb();
            const trackedAircraft = await db.all<{ icao24: string }[]>(`
                SELECT DISTINCT icao24 
                FROM aircraft 
                WHERE icao24 IS NOT NULL 
                AND LENGTH(TRIM(icao24)) > 0
            `);

            const icao24s = trackedAircraft.map((a) => a.icao24);

            // Use the singleton instance
            const positions = await openSkyService.getPositions(icao24s);

            // Update active_tracking table
            await this.updateActiveAircraft(positions);
        } catch (error) {
            console.error('Error syncing active aircraft:', error);
        }
    }
}
