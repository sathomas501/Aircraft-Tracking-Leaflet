
import { trackingDb } from '../trackingDatabaseManager';
import { open, Database } from 'sqlite';

let sqlite3: typeof import('sqlite3');
if (typeof window === 'undefined') {
    sqlite3 = require('sqlite3');
}

export async function getActiveDatabase(): Promise<Database> {
    return await open({
        filename: './lib/db/tracking.db',
        driver: sqlite3!.Database,
    });
}
const STATIC_DB_PATH = '.lib/db/static.db'; // Path to the static database

/**
 * Get a list of `icao24` codes for a specific manufacturer.
 * @param manufacturer - The manufacturer name to filter by.
 * @param model - (Optional) The model name to filter by.
 */
export async function getIcao24s(manufacturer: string, model?: string): Promise<string[]> {
    const db = await open({ filename: STATIC_DB_PATH, driver: sqlite3.Database });

    const query = `
        SELECT icao24
        FROM aircraft
        WHERE manufacturer = ?
        ${model ? 'AND model = ?' : ''}
    `;

    const rows = await db.all(query, model ? [manufacturer, model] : [manufacturer]);
    return rows.map((row) => row.icao24);
}

/**
 * Get combined static and live data for active aircraft.
 * @param manufacturer - The manufacturer name to filter by.
 */
export async function getCombinedAircraftData(manufacturer: string): Promise<any[]> {
    const staticDb = await open({ filename: STATIC_DB_PATH, driver: sqlite3.Database });

    // Fetch static data
    const staticData = await staticDb.all(`
        SELECT icao24, manufacturer, model
        FROM aircraft
        WHERE manufacturer = ?
    `, [manufacturer]);

    // Fetch live data from the tracking database
    const liveData = await trackingDb.getActiveAircraft(manufacturer);

    // Combine static and live data
    const combinedData = liveData.map((live) => {
        const staticInfo = staticData.find((s) => s.icao24 === live.icao24) || {};
        return { ...staticInfo, ...live };
    });

    return combinedData;
}
