// server/init.ts
import { CleanupService } from '../lib/services/CleanupService';
import { initializeAircraftCache } from '../lib/services/managers/initializeAircraftCache';
import { TrackingDatabaseManager } from '../lib/db/trackingDatabaseManager';

let initPromise: Promise<void> | null = null;
let isInitialized = false;

function createInitPromise() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        if (isInitialized) return;

        try {
            await TrackingDatabaseManager.getInstance();
            console.log('[Init] Database initialized');
            
            const cleanupService = CleanupService.getInstance();
            await cleanupService.initialize();
            
            await initializeAircraftCache();
            console.log('[Init] Cache initialized');

            isInitialized = true;
            console.log('[Init] Services initialized successfully');
            setupShutdown();
        } catch (error) {
            console.error('[Init] Failed to initialize:', error);
            isInitialized = false;
            initPromise = null;
            throw error;
        }
    })();

    return initPromise;
}

export async function initializeApp() {
    if (typeof window !== 'undefined') return;
    return createInitPromise();
}

function setupShutdown() {
    if (typeof window !== 'undefined') return;
    
    const cleanupService = CleanupService.getInstance();
    const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
        const timeoutId = setTimeout(() => {
            process.exit(1);
        }, 10000).unref();

        try {
            await Promise.all([
                cleanupService.shutdown(),
                TrackingDatabaseManager.getInstance().stop()
            ]);
            process.exit(0);
        } catch (error) {
            console.error('[Shutdown] Error:', error);
            process.exit(1);
        } finally {
            clearTimeout(timeoutId);
        }
    };

    ['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(signal => {
        process.on(signal, () => shutdown(signal));
    });
}

// Initialize without top-level await
if (typeof window === 'undefined') {
    createInitPromise().catch(() => process.exit(1));
}
