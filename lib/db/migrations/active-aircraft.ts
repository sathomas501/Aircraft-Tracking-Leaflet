import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { TrackingDatabaseManager } from '../trackingDatabaseManager';
import { AircraftStatus, ActiveAircraftRecord, AircraftRecord } from '@/types/database';

const STATIC_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'static.db');

export async function getActiveDatabase(): Promise<Database> {
    const trackingDb = TrackingDatabaseManager.getInstance();
    await trackingDb.initialize();
    return trackingDb.getDb();
}

/**
 * Get a list of `icao24` codes for a specific manufacturer.
 * @param manufacturer - The manufacturer name to filter by.
 * @param model - (Optional) The model name to filter by.
 */
export async function getIcao24s(manufacturer: string, model?: string): Promise<string[]> {
    const db = await open({ filename: STATIC_DB_PATH, driver: sqlite3.Database });

    const query = `
        SELECT DISTINCT icao24
        FROM aircraft
        WHERE manufacturer = ?
        ${model ? 'AND model = ?' : ''}
        AND icao24 IS NOT NULL
        AND icao24 != ''
    `;

    try {
        const rows = await db.all<Pick<AircraftRecord, 'icao24'>[]>(query, model ? [manufacturer, model] : [manufacturer]);
        return rows.map(row => row.icao24);
    } finally {
        await db.close();
    }
}

/**
 * Get combined static and live data for active aircraft.
 * @param manufacturer - The manufacturer name to filter by.
 */
export async function getCombinedAircraftData(manufacturer: string): Promise<ActiveAircraftRecord[]> {
    const staticDb = await open({ filename: STATIC_DB_PATH, driver: sqlite3.Database });
    const trackingDb = TrackingDatabaseManager.getInstance();
    await trackingDb.initialize();

    try {
        // Fetch static data
        const staticData = await staticDb.all<AircraftRecord[]>(`
            SELECT DISTINCT icao24, manufacturer, model, "N-NUMBER", NAME, CITY, STATE, owner_type, aircraft_type
            FROM aircraft
            WHERE manufacturer = ?
            AND icao24 IS NOT NULL
            AND icao24 != ''
        `, [manufacturer]);

        // Get live data using tracking database
        const query = `
            SELECT *
            FROM aircraft
            WHERE manufacturer = ?
            AND last_contact >= datetime('now', '-5 minutes')
        `;
        const liveData = await trackingDb.getAll<ActiveAircraftRecord>(query, [manufacturer]);

        // Combine static and live data
        const combinedData = liveData.map((live: ActiveAircraftRecord) => {
            const staticInfo = staticData.find(s => s.icao24 === live.icao24) || {
                icao24: live.icao24,
                manufacturer,
                model: 'Unknown',
                "N-NUMBER": '',
                NAME: '',
                CITY: '',
                STATE: '',
                owner_type: '',
                aircraft_type: ''
            };

            return {
                ...staticInfo,
                ...live,
                is_active: true
            };
        });

        return combinedData;
    } finally {
        await staticDb.close();
    }
}