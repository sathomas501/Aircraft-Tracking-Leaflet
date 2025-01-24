// lib/shutdown.ts
import { openSkyService } from './services/opensky/service';
import { CleanupService } from './services/CleanupService';  // Fixed casing
import { getDatabase } from './db/databaseManager';

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
        
        // Stop cleanup service first
        const cleanupService = CleanupService.getInstance();
        await cleanupService.stop();
        console.log('Cleanup service stopped');

        // Stop OpenSky service
        openSkyService.cleanup();
        console.log('OpenSky service cleaned up');

        // 2. Run final cleanup
        console.log('Running final cleanup...');
        await cleanupService.cleanup();
        console.log('Final cleanup completed');

        // 3. Close database connections
        console.log('Closing database connections...');
        const activeDb = await getDatabase();
        await activeDb.close();
        console.log('Active database connection closed');

        console.log('Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle termination signals
process.on('SIGINT', () => shutdownHandler('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => shutdownHandler('SIGTERM')); // kill command
process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // nodemon restart

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await shutdownHandler('uncaughtException');
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await shutdownHandler('unhandledRejection');
});

// Force exit if graceful shutdown takes too long
const FORCE_SHUTDOWN_TIMEOUT = 10000; // 10 seconds

process.on('SIGINT', () => {
    setTimeout(() => {
        console.error('Forcing shutdown after timeout...');
        process.exit(1);
    }, FORCE_SHUTDOWN_TIMEOUT).unref();
});