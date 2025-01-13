// lib/services/cleanupService.ts
import { getActiveDb } from '@/lib/db/activeConnection';

export class CleanupService {
    private static instance: CleanupService;
    private cleanupInterval: NodeJS.Timeout | null = null;  // Changed from Timer
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private readonly STALE_THRESHOLD = 2 * 60 * 60; // 2 hours in seconds

    private constructor() {
        this.startCleanupJob();
    }

    public static getInstance(): CleanupService {
        if (!this.instance) {
            this.instance = new CleanupService();
        }
        return this.instance;
    }

    private startCleanupJob(): void {
        // Run initial cleanup
        this.cleanup().catch(error => {
            console.error('Error during initial cleanup:', error);
        });

        // Set up periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanup().catch(error => {
                console.error('Error during periodic cleanup:', error);
            });
        }, this.CLEANUP_INTERVAL);
    }

    public async cleanup(): Promise<void> {
        try {
            const db = await getActiveDb();
            
            // Get current timestamp
            const currentTime = Math.floor(Date.now() / 1000);
            const staleThreshold = currentTime - this.STALE_THRESHOLD;

            // Start transaction for cleanup
            await db.run('BEGIN TRANSACTION');

            try {
                // Remove stale entries
                const result = await db.run(`
                    DELETE FROM active_aircraft 
                    WHERE last_contact < ?
                `, [staleThreshold]);

                if (result.changes && result.changes > 0) {
                    console.log(`Cleaned up ${result.changes} stale aircraft entries`);
                }

                // Clean up any orphaned records (optional)
                const orphanResult = await db.run(`
                    DELETE FROM active_aircraft
                    WHERE icao24 NOT IN (
                        SELECT icao24 FROM active_aircraft
                        WHERE last_contact >= ?
                    )
                `, [staleThreshold]);

                if (orphanResult.changes && orphanResult.changes > 0) {
                    console.log(`Cleaned up ${orphanResult.changes} orphaned records`);
                }

                // VACUUM to reclaim space (periodically)
                if (Math.random() < 0.1) { // 10% chance each cleanup
                    await db.run('VACUUM');
                    console.log('Database vacuumed to reclaim space');
                }

                await db.run('COMMIT');

            } catch (error) {
                await db.run('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error('Cleanup failed:', error);
            throw error;
        }
    }

    public async stop(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    public getStats(): {
        cleanupInterval: number;
        staleThreshold: number;
        isRunning: boolean;
    } {
        return {
            cleanupInterval: this.CLEANUP_INTERVAL,
            staleThreshold: this.STALE_THRESHOLD,
            isRunning: this.cleanupInterval !== null
        };
    }
}