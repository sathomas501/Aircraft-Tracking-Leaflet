// lib/services/cleanup/cleanupService.ts
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import {
  errorHandler,
  ErrorType,
} from '../services/error-handler/error-handler';

class CleanupService {
  private static instance: CleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;
  private isInitialized = false;
  private dbManager: TrackingDatabaseManager | null = null;

  // Configuration
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.dbManager = TrackingDatabaseManager.getInstance();
  }

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

  async cleanup(): Promise<number> {
    if (!this.dbManager) {
      console.error('[Cleanup Service] ❌ Database manager not initialized');
      return 0;
    }

    console.log('[Cleanup Service] 🧹 Running cleanup...');
    const staleThreshold = Math.floor(
      (Date.now() - this.STALE_THRESHOLD) / 1000
    );
    let removedCount = 0;

    try {
      // Use a single connection for the entire operation
      const db = await this.dbManager.getDatabase();

      // Add a longer timeout for busy operations
      await db.run('PRAGMA busy_timeout = 10000');

      try {
        // Begin a transaction
        await db.run('BEGIN TRANSACTION');

        // Clean up tracked_aircraft - use direct db.run instead of executeQuery
        const trackedResult = await db.run(
          'DELETE FROM tracked_aircraft WHERE last_contact < ?',
          [staleThreshold]
        );

        const trackedRemoved = trackedResult?.changes || 0;
        console.log(
          `[Cleanup Service] ✅ Removed ${trackedRemoved} stale tracked aircraft`
        );
        removedCount += trackedRemoved;

        // Small delay to reduce contention
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Clean up pending_aircraft - use direct db.run instead of executeQuery
        const pendingResult = await db.run(
          'DELETE FROM pending_aircraft WHERE last_contact < ?',
          [staleThreshold]
        );

        const pendingRemoved = pendingResult?.changes || 0;
        console.log(
          `[Cleanup Service] ✅ Removed ${pendingRemoved} stale pending aircraft`
        );
        removedCount += pendingRemoved;

        // Commit the transaction
        await db.run('COMMIT');

        // Only do database optimization occasionally
        const shouldOptimize = Math.random() < 0.2; // 20% chance
        if (shouldOptimize) {
          try {
            await db.run('PRAGMA optimize');
            console.log('[Cleanup Service] ✅ Database optimized');
          } catch (optimizeError) {
            console.warn(
              '[Cleanup Service] ⚠️ Optimization error:',
              optimizeError
            );
          }
        }

        return removedCount;
      } catch (error) {
        // Rollback on error
        try {
          await db.run('ROLLBACK');
          console.log(
            '[Cleanup Service] ↩️ Transaction rolled back due to error'
          );
        } catch (rollbackError) {
          console.error('[Cleanup Service] ❌ Rollback failed:', rollbackError);
        }

        throw error; // Re-throw for outer catch block
      }
    } catch (error) {
      console.error(
        '[Cleanup Service] ❌ Failed to clean stale records:',
        error
      );
      errorHandler.handleError(
        ErrorType.OPENSKY_CLEANUP,
        error instanceof Error ? error : new Error('Cleanup failed')
      );

      return 0;
    }
  }

  /**
   * Cleanup stale records for a specific manufacturer
   */
  public async cleanupManufacturer(
    manufacturer: string,
    olderThan?: number
  ): Promise<{ trackedRemoved: number; pendingRemoved: number }> {
    if (!manufacturer) {
      throw new Error(
        '[CleanupService] ❌ Manufacturer is required for cleanup.'
      );
    }

    if (!this.dbManager) {
      console.error('[CleanupService] ❌ Database manager is not initialized.');
      return { trackedRemoved: 0, pendingRemoved: 0 };
    }

    console.log(
      `[CleanupService] 🧹 Cleaning up aircraft for manufacturer: ${manufacturer}`
    );

    try {
      // Get a single database connection
      const db = await this.dbManager.getDatabase();

      // Set longer timeout for busy operations
      await db.run('PRAGMA busy_timeout = 10000');

      try {
        // Begin transaction with direct db call
        await db.run('BEGIN TRANSACTION');

        // ✅ Cleanup tracked aircraft with direct db.run
        const deleteTrackedQuery = `
        DELETE FROM tracked_aircraft
        WHERE manufacturer = ? ${olderThan ? 'AND updated_at < ?' : ''}
      `;

        const trackedResult = await db.run(
          deleteTrackedQuery,
          olderThan ? [manufacturer, olderThan] : [manufacturer]
        );

        // Small delay to reduce contention
        await new Promise((resolve) => setTimeout(resolve, 100));

        // ✅ Cleanup pending aircraft with direct db.run
        const deletePendingQuery = `
        DELETE FROM pending_aircraft
        WHERE manufacturer = ? ${olderThan ? 'AND updated_at < ?' : ''}
      `;

        const pendingResult = await db.run(
          deletePendingQuery,
          olderThan ? [manufacturer, olderThan] : [manufacturer]
        );

        // Extract changes from results
        const trackedRemoved = trackedResult?.changes || 0;
        const pendingRemoved = pendingResult?.changes || 0;

        // Commit transaction with direct db call
        await db.run('COMMIT');

        console.log(
          `[CleanupService] ✅ Cleanup complete: Removed ${trackedRemoved} tracked, ${pendingRemoved} pending aircraft.`
        );

        return { trackedRemoved, pendingRemoved };
      } catch (error) {
        // Rollback on error with direct db call
        try {
          await db.run('ROLLBACK');
          console.log(
            '[CleanupService] ↩️ Transaction rolled back due to error'
          );
        } catch (rollbackError) {
          console.error('[CleanupService] ❌ Rollback failed:', rollbackError);
        }

        throw error; // Re-throw for outer catch block
      }
    } catch (error) {
      console.error(
        `[CleanupService] ❌ Cleanup failed for ${manufacturer}:`,
        error
      );

      return { trackedRemoved: 0, pendingRemoved: 0 };
    }
  }

  // ✅ Add shutdown method
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('[CleanupService] 🚀 Shutting down cleanup operations...');

    try {
      // Perform any necessary cleanup tasks
      // Example: Closing DB connections, clearing timers, etc.
      console.log('[CleanupService] ✅ CleanupService shutdown complete');
    } catch (error) {
      console.error('[CleanupService] ❌ Error during shutdown:', error);
    }
  }
}

// ✅ Ensure only one `export default`
export default CleanupService;
