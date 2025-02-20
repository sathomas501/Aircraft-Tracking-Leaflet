// lib/services/cleanup/cleanupService.ts
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import {
  errorHandler,
  ErrorType,
} from '../services/error-handler/error-handler';

export class CleanupService {
  private static instance: CleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isInitialized = false;
  private dbManager: TrackingDatabaseManager | null = null;

  // Configuration
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours
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
    if (this.isInitialized) return;

    try {
      this.dbManager = TrackingDatabaseManager.getInstance();
      await this.dbManager.initializeDatabase();
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

    // Allow the interval to not block the event loop in Node.js
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public async cleanup(): Promise<void> {
    if (!this.dbManager) {
      throw new Error('[Cleanup Service] Database manager not initialized');
    }

    console.log('[Cleanup Service] 🧹 Running cleanup...');
    const staleThreshold = Math.floor(
      (Date.now() - this.STALE_THRESHOLD) / 1000
    );

    try {
      // Start a transaction for the cleanup
      await this.dbManager.executeQuery('BEGIN TRANSACTION');

      // Clean up active tracking
      const cleanupQuery = `
        DELETE FROM active_tracking 
        WHERE last_seen < ? OR last_contact < ?
      `;
      await this.dbManager.executeQuery(cleanupQuery, [
        staleThreshold,
        staleThreshold,
      ]);

      // Clean up tracked aircraft
      const trackingCleanupQuery = `
        DELETE FROM tracked_aircraft 
        WHERE last_contact < ?
      `;
      await this.dbManager.executeQuery(trackingCleanupQuery, [staleThreshold]);

      // Commit the transaction
      await this.dbManager.executeQuery('COMMIT');
      console.log(`[Cleanup Service] ✅ Cleaned up stale records`);

      // Optimize the database
      await this.dbManager.executeQuery('PRAGMA optimize');
      await this.dbManager.executeQuery('VACUUM');
      console.log('[Cleanup Service] ✅ Database optimized');
    } catch (error) {
      // Rollback on error
      try {
        await this.dbManager.executeQuery('ROLLBACK');
      } catch (rollbackError) {
        console.error('[Cleanup Service] ❌ Rollback failed:', rollbackError);
      }

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

  public async shutdown(): Promise<void> {
    console.log('[Cleanup Service] 🛑 Initiating shutdown...');
    this.isShuttingDown = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.dbManager) {
      try {
        // Run final cleanup
        await this.cleanup();
        // Close database connection
        await this.dbManager.close();
      } catch (error) {
        console.error('[Cleanup Service] ❌ Final cleanup failed:', error);
      }
    }

    this.dbManager = null;
    this.isInitialized = false;
    console.log('[Cleanup Service] ✅ Shutdown complete');
  }
}

export default CleanupService;
