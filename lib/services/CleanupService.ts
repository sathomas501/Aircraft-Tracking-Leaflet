import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';

export class CleanupService {
    private static instance: CleanupService;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;
    private isInitialized = false;

    // Interval for periodic cleanup (default: 5 minutes)
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000;
    // Threshold for stale records (default: 2 hours)
    private readonly STALE_THRESHOLD = 2 * 60 * 60 * 1000; // In milliseconds
    private retryCount = 0;
    private readonly MAX_RETRIES = 3;

    private constructor() {}

    public static getInstance(): CleanupService {
        if (!CleanupService.instance) {
            CleanupService.instance = new CleanupService();
        }
        return CleanupService.instance;
    }

    // Initialize the service
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            const dbManager = TrackingDatabaseManager.getInstance();
            await dbManager.initialize(); // Ensure database is initialized
            await this.startCleanupJob();
            this.isInitialized = true;
            console.log('[Cleanup Service] Initialized successfully');
        } catch (error) {
            console.error('[Cleanup Service] Initialization failed:', error);
            await this.retryInitialization();
        }
    }

    // Retry initialization on failure
    private async retryInitialization(): Promise<void> {
        if (this.retryCount >= this.MAX_RETRIES) {
            throw new Error('[Cleanup Service] Max retries reached');
        }

        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.initialize();
    }

    // Start the periodic cleanup job
    private async startCleanupJob(): Promise<void> {
        console.log('[Cleanup Service] Starting cleanup job...');
        await this.cleanup();

        this.cleanupInterval = setInterval(() => {
            if (!this.isShuttingDown) {
                this.cleanup().catch((error) => {
                    console.error('[Cleanup Service] Cleanup job failed:', error);
                });
            }
        }, this.CLEANUP_INTERVAL);

        // For Node.js: Allow the interval to not block the event loop
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    // Cleanup stale records
    public async cleanup(): Promise<void> {
        console.log('[Cleanup Service] Running cleanup...');
        const dbManager = TrackingDatabaseManager.getInstance();
        const staleThreshold = Date.now() - this.STALE_THRESHOLD;

        try {
            await dbManager.cleanStaleRecords(); // Use the specific method
            console.log('[Cleanup Service] Stale records cleaned up');
        } catch (error) {
            console.error('[Cleanup Service] Failed to clean stale records:', error);
        }
    }

    // Graceful shutdown of the service
    public async shutdown(): Promise<void> {
        this.isShuttingDown = true;
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        const dbManager = TrackingDatabaseManager.getInstance();
        await dbManager.stop();
        console.log('[Cleanup Service] Shutdown complete');
    }
}
