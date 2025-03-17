// lib/shutdown.ts
import CleanupService from './services/CleanupService';
import { TrackingDatabaseManager } from './db/managers/trackingDatabaseManager';

let isShuttingDown = false;

async function shutdownHandler(signal: string) {
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }

  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;

  try {
    // 1. Stop accepting new connections/updates
    console.log('Stopping services...');

    // ✅ Ensure CleanupService is awaited before using it
    const cleanupService = await CleanupService.getInstance();

    await cleanupService.shutdown();
    console.log('Cleanup service stopped');

    // 2. Run final cleanup
    console.log('Running final cleanup...');
    await cleanupService.cleanup();
    console.log('Final cleanup completed');

    // 3. Close database connections
    console.log('Closing database connections...');

    // ✅ Ensure trackingDb is awaited before calling `.close()`
    const trackingDb = await TrackingDatabaseManager.getInstance();
    await trackingDb.close();

    console.log('Active database connection closed');

    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}
