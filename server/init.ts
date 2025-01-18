// server/init.ts
import { CleanupService } from '../lib/services/CleanupService';

if (typeof window === 'undefined') {
    const cleanupService = CleanupService.getInstance();

    // Handle shutdown signals
    const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
        
        try {
            await cleanupService.stop();
            console.log('Cleanup service stopped');

            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    };

    // Handle various shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2'));

    // Force shutdown after timeout
    const FORCE_SHUTDOWN_TIMEOUT = 10000;
    process.on('SIGINT', () => {
        setTimeout(() => {
            console.error('Forcing shutdown after timeout...');
            process.exit(1);
        }, FORCE_SHUTDOWN_TIMEOUT).unref();
    });
}

// Export something to prevent module parse errors
export const initialized = true;