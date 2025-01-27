import { trackingDb } from '@/lib/db/trackingDatabaseManager';

export async function initializeTrackingDb() {
    await trackingDb.initialize();
    console.log('[Tracking Database] Initialized on startup.');
}
