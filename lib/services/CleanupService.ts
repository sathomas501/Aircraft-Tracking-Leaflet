import BackendDatabaseManager from '../db/backendDatabaseManager';
import {
  errorHandler,
  ErrorType,
} from '../services/error-handler/error-handler';

export class CleanupService {
  private static instance: CleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isInitialized = false;
  private dbManager: BackendDatabaseManager | null = null;

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
      this.dbManager = await BackendDatabaseManager.getInstance();
      await this.startCleanupJob();
      this.isInitialized = true;
      console.log('[Cleanup Service] ✅ Initialized successfully');
    } catch (error) {
      console.error('[Cleanup Service] ❌ Initialization failed:', error);
      errorHandler.handleError(
        ErrorType.CRITICAL,
        error instanceof Error ? error : new Error('Initialization failed')
      );
      await this.retryInitialization();
    }
  }

  // Retry initialization on failure
  private async retryInitialization(): Promise<void> {
    if (this.retryCount >= this.MAX_RETRIES) {
      const error = new Error('[Cleanup Service] Max retries reached');
      errorHandler.handleError(ErrorType.CRITICAL, error);
      throw error;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.initialize();
  }

  // Start the periodic cleanup job
  private async startCleanupJob(): Promise<void> {
    console.log('[Cleanup Service] 🚀 Starting cleanup job...');
    await this.cleanup();

    this.cleanupInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.cleanup().catch((error) => {
          console.error('[Cleanup Service] ❌ Cleanup job failed:', error);
          errorHandler.handleError(
            ErrorType.OPENSKY_CLEANUP,
            error instanceof Error ? error : new Error('Cleanup failed')
          );
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
    if (!this.dbManager) {
      throw new Error('[Cleanup Service] Database manager not initialized');
    }

    console.log('[Cleanup Service] 🧹 Running cleanup...');
    const staleThreshold = Math.floor(
      (Date.now() - this.STALE_THRESHOLD) / 1000
    );

    try {
      const query = `
        DELETE FROM active_tracking 
        WHERE last_seen < ? OR last_contact < ?
      `;

      const result = await this.dbManager.executeQuery(query, [
        staleThreshold,
        staleThreshold,
      ]);
      console.log(`[Cleanup Service] ✅ Cleaned up stale records`);

      // Run VACUUM periodically to reclaim space
      await this.dbManager.executeQuery('VACUUM');
      console.log('[Cleanup Service] ✅ Database optimized');
    } catch (error) {
      console.error(
        '[Cleanup Service] ❌ Failed to clean stale records:',
        error
      );
      errorHandler.handleError(
        ErrorType.OPENSKY_CLEANUP,
        error instanceof Error ? error : new Error('Cleanup failed')
      );
      throw error;
    }
  }

  // Graceful shutdown of the service
  public async shutdown(): Promise<void> {
    console.log('[Cleanup Service] 🛑 Initiating shutdown...');
    this.isShuttingDown = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.dbManager) {
      // Run one final cleanup before shutting down
      try {
        await this.cleanup();
      } catch (error) {
        console.error('[Cleanup Service] ❌ Final cleanup failed:', error);
      }
    }

    this.dbManager = null;
    this.isInitialized = false;
    console.log('[Cleanup Service] ✅ Shutdown complete');
  }
}
