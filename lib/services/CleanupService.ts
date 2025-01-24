// lib/services/CleanupService.ts
import { trackingDb, TrackingDatabaseManager } from '../db/trackingDatabaseManager';
import { Database } from 'sqlite';

export class CleanupService {
    private static instance: CleanupService;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;
    private isInitialized = false;
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000;
    private readonly STALE_THRESHOLD = 2 * 60 * 60;
    private retryCount = 0;
    private readonly MAX_RETRIES = 3;

    private constructor() {}

    public static getInstance(): CleanupService {
        if (!CleanupService.instance) {
            CleanupService.instance = new CleanupService();
        }
        return CleanupService.instance;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized || typeof window !== 'undefined') return;

        try {
            await trackingDb.initialize();
            await this.startCleanupJob();
            this.isInitialized = true;
            console.log('[Cleanup Service] Initialized successfully');
        } catch (error) {
            console.error('[Cleanup Service] Initialization failed:', error);
            await this.retryInitialization();
        }
    }

    private async retryInitialization(): Promise<void> {
        if (this.retryCount >= this.MAX_RETRIES) {
            throw new Error('[Cleanup Service] Max retries reached');
        }

        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.initialize();
    }

    private async startCleanupJob(): Promise<void> {
        await this.cleanup();
        
        this.cleanupInterval = setInterval(() => {
            if (!this.isShuttingDown) {
                this.cleanup().catch(console.error);
            }
        }, this.CLEANUP_INTERVAL);

        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    public async cleanup(): Promise<void> {
        if (typeof window !== 'undefined') return;

        try {
            await trackingDb.initialize();
            const currentTime = Math.floor(Date.now() / 1000);
            const staleThreshold = currentTime - this.STALE_THRESHOLD;

            const result = await trackingDb.db?.run(
                `DELETE FROM active_tracking WHERE last_contact < ?`,
                [staleThreshold]
            );
            console.log(`[Cleanup Service] Cleaned up ${result?.changes || 0} stale aircraft entries`);

            if (!this.isShuttingDown) {
                const orphanResult = await trackingDb.db?.run(
                    `DELETE FROM active_tracking WHERE icao24 NOT IN (
                        SELECT icao24 FROM active_tracking WHERE last_contact >= ?
                    )`,
                    [staleThreshold]
                );
                console.log(`[Cleanup Service] Cleaned up ${orphanResult?.changes || 0} orphaned records`);
            }

            if (Math.random() < 0.1) {
                await trackingDb.db?.run('VACUUM');
            }
        } catch (error) {
            console.error('[Cleanup Service] Cleanup failed:', error);
            throw error;
        }
    }

    public async stop(): Promise<void> {
        if (typeof window !== 'undefined') return;

        this.isShuttingDown = true;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        try {
            await this.cleanup();
            this.isInitialized = false;
        } catch (error) {
            console.error('[Cleanup Service] Error during final cleanup:', error);
            throw error;
        }
    }

    public getStats() {
        return {
            cleanupInterval: this.CLEANUP_INTERVAL,
            staleThreshold: this.STALE_THRESHOLD,
            isRunning: typeof window === 'undefined' && this.cleanupInterval !== null,
            isShuttingDown: this.isShuttingDown,
            isInitialized: this.isInitialized,
            retryCount: this.retryCount,
        };
    }
}