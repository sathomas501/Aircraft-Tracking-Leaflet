import { getActiveDb } from '../db/trackingDatabaseManager';

const isServer = typeof window === 'undefined';

export class CleanupService {
    private static instance: CleanupService;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;
    private isInitialized = false;
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private readonly STALE_THRESHOLD = 2 * 60 * 60; // 2 hours in seconds
    private retryCount = 0;
    private readonly MAX_RETRIES = 3;

    private constructor() {
        if (isServer) {
            this.initializeService();
        }
    }

    public static getInstance(): CleanupService {
        if (!CleanupService.instance) {
            CleanupService.instance = new CleanupService();
        }
        return CleanupService.instance;
    }

    private async initializeService(): Promise<void> {
        if (this.isInitialized || !isServer) return;

        try {
            await this.startCleanupJob();
            this.isInitialized = true;
            console.log('[Cleanup Service] Initialized successfully');
        } catch (error) {
            console.error('[Cleanup Service] Initialization failed:', error);
            this.retryInitialization();
        }
    }

    private retryInitialization(): void {
        if (this.retryCount >= this.MAX_RETRIES) {
            console.error('[Cleanup Service] Max retries reached. Service initialization failed.');
            return;
        }

        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
        console.log(`[Cleanup Service] Retrying initialization in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);

        setTimeout(() => {
            this.initializeService();
        }, delay);
    }

    private async startCleanupJob(): Promise<void> {
        if (!isServer) return;

        try {
            await this.cleanup();
            console.log('[Cleanup Service] Initial cleanup completed successfully');
        } catch (error) {
            console.error('[Cleanup Service] Error during initial cleanup:', error);
            throw error;
        }

        this.cleanupInterval = setInterval(() => {
            if (!this.isShuttingDown) {
                this.cleanup().catch((error) => {
                    console.error('[Cleanup Service] Error during periodic cleanup:', error);
                });
            }
        }, this.CLEANUP_INTERVAL);

        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    public async cleanup(): Promise<void> {
        if (!isServer) return;

        const db = await getActiveDb();
        if (!db) {
            console.error('[Cleanup Service] Unable to get database connection');
            return;
        }

        try {
            const tableCheck = await db.all(
                'SELECT name FROM sqlite_master WHERE type="table" AND name="active_tracking";'
            );

            if (tableCheck.length === 0) {
                console.log('[Cleanup Service] Table "active_tracking" does not exist yet, skipping cleanup');
                return;
            }

            // Regular cleanup in a transaction
            await this.performCleanup(db);

            // Vacuum outside of transaction, with a random chance
            if (Math.random() < 0.1) {  // 10% chance to vacuum
                try {
                    await db.run('VACUUM');
                    console.log('[Cleanup Service] Database vacuumed successfully');
                } catch (error) {
                    console.error('[Cleanup Service] Vacuum operation failed:', error);
                    // Don't throw here, as vacuum failure shouldn't stop normal operation
                }
            }

        } catch (error) {
            console.error('[Cleanup Service] Cleanup failed:', error);
            throw error;
        } finally {
            try {
                await db.close();
            } catch (error) {
                console.error('[Cleanup Service] Error closing database connection:', error);
            }
        }
    }

    private async performCleanup(db: any): Promise<void> {
        const currentTime = Math.floor(Date.now() / 1000);
        const staleThreshold = currentTime - this.STALE_THRESHOLD;

        await db.run('BEGIN TRANSACTION');

        try {
            // Clean up stale entries
            const result = await db.run(
                `DELETE FROM active_tracking WHERE last_contact < ?`,
                [staleThreshold]
            );
            console.log(`[Cleanup Service] Cleaned up ${result.changes || 0} stale aircraft entries`);

            if (!this.isShuttingDown) {
                // Clean up orphaned records
                const orphanResult = await db.run(
                    `
                    DELETE FROM active_tracking
                    WHERE icao24 NOT IN (
                        SELECT icao24 FROM active_tracking WHERE last_contact >= ?
                    )
                    `,
                    [staleThreshold]
                );
                console.log(`[Cleanup Service] Cleaned up ${orphanResult.changes || 0} orphaned records`);
            }

            await db.run('COMMIT');
        } catch (error) {
            await db.run('ROLLBACK');
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
            this.isInitialized = false;
            console.log('[Cleanup Service] Final cleanup completed successfully');
        } catch (error) {
            console.error('[Cleanup Service] Error during final cleanup:', error);
            throw error;
        }
    }

    public getStats(): {
        cleanupInterval: number;
        staleThreshold: number;
        isRunning: boolean;
        isShuttingDown: boolean;
        isInitialized: boolean;
        retryCount: number;
    } {
        return {
            cleanupInterval: this.CLEANUP_INTERVAL,
            staleThreshold: this.STALE_THRESHOLD,
            isRunning: isServer && this.cleanupInterval !== null,
            isShuttingDown: this.isShuttingDown,
            isInitialized: this.isInitialized,
            retryCount: this.retryCount,
        };
    }
}

export const cleanupService = CleanupService.getInstance();