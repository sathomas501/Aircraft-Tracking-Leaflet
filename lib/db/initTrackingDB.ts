// lib/db/initTrackingDB.ts
import { TrackingDatabaseManager } from './trackingDatabaseManager';

export async function initializeTrackingDB(): Promise<void> {
    const trackingDb = TrackingDatabaseManager.getInstance();
    await trackingDb.initialize();
    console.log('Tracking database initialized');
}