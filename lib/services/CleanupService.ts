// lib/services/CleanupService.ts
import { getActiveDb } from '../db/databaseManager';

let isServer = false;
try {
    isServer = typeof window === 'undefined';
} catch (e) {
    isServer = true;
}

export class CleanupService {
    private static instance: CleanupService;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private readonly STALE_THRESHOLD = 2 * 60 * 60; // 2 hours in seconds

    private constructor() {
        if (isServer) {
            this.startCleanupJob();
        }
    }

    public static getInstance(): CleanupService {
        if (!this.instance) {
            this.instance = new CleanupService();
        }
        return this.instance;
    }

    private async startCleanupJob(): Promise<void> {
        if (!isServer) return;
        
        // Run initial cleanup
        this.cleanup().catch(error => {
            console.error('Error during initial cleanup:', error);
        });

        // Set up periodic cleanup
        this.cleanupInterval = setInterval(() => {
            if (!this.isShuttingDown) {
                this.cleanup().catch(error => {
                    console.error('Error during periodic cleanup:', error);
                });
            }
        }, this.CLEANUP_INTERVAL);

        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    public async cleanup(): Promise<void> {
        if (!isServer) return;

        try {
            const db = await getActiveDb();
            
            const currentTime = Math.floor(Date.now() / 1000);
            const staleThreshold = currentTime - this.STALE_THRESHOLD;

            await db.run('BEGIN TRANSACTION');

            try {
                const result = await db.run(`
                    DELETE FROM active_tracking 
                    WHERE last_contact < ?
                `, [staleThreshold]);

                if (result.changes && result.changes > 0) {
                    console.log(`Cleaned up ${result.changes} stale aircraft entries`);
                }

                if (!this.isShuttingDown) {
                    const orphanResult = await db.run(`
                        DELETE FROM active_tracking
                        WHERE icao24 NOT IN (
                            SELECT icao24 FROM active_tracking
                            WHERE last_contact >= ?
                        )
                    `, [staleThreshold]);

                    if (orphanResult.changes && orphanResult.changes > 0) {
                        console.log(`Cleaned up ${orphanResult.changes} orphaned records`);
                    }

                    if (Math.random() < 0.1) {
                        await db.run('VACUUM');
                        console.log('Database vacuumed to reclaim space');
                    }
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
        if (!isServer) return;

        this.isShuttingDown = true;
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        try {
            await this.cleanup();
            console.log('Final cleanup completed successfully');
        } catch (error) {
            console.error('Error during final cleanup:', error);
            throw error;
        }
    }

    public getStats(): {
        cleanupInterval: number;
        staleThreshold: number;
        isRunning: boolean;
        isShuttingDown: boolean;
    } {
        return {
            cleanupInterval: this.CLEANUP_INTERVAL,
            staleThreshold: this.STALE_THRESHOLD,
            isRunning: isServer && this.cleanupInterval !== null,
            isShuttingDown: this.isShuttingDown
        };
    }
}