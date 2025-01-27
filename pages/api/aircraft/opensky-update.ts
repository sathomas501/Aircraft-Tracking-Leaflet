import { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/trackingDatabaseManager';
import { Database } from 'sqlite';

// Define our own interface for SQLite run result
interface SQLiteRunResult {
    changes: number;
    lastID: number;
}

interface OpenSkyState {
    icao24: string;
    callsign?: string;
    origin_country?: string;
    time_position?: number;
    last_contact: number;
    longitude: number;
    latitude: number;
    altitude?: number;
    on_ground: boolean;
    velocity?: number;
    heading?: number;
    vertical_rate?: number;
    sensors?: number[];
    geo_altitude?: number;
    squawk?: string;
    spi?: boolean;
    position_source?: number;
}

async function withDatabase<T>(
    operation: (db: Database) => Promise<T>
): Promise<T | null> {
    const dbManager = TrackingDatabaseManager.getInstance();
    await dbManager.initialize(); // Ensure the database connection is initialized
    const db = dbManager.getDb(); // Add a method to return the raw `sqlite` instance if needed

    try {
        return await operation(db);
    } catch (error) {
        console.error('Database operation failed:', error);
        throw error;
    } finally {
        try {
            await dbManager.stop(); // Gracefully close the connection
        } catch (error) {
            console.error('Error closing database connection:', error);
        }
    }
}


async function updatePositions(positions: OpenSkyState[]): Promise<number> {
    return await withDatabase(async (db) => {
        await db.run('BEGIN TRANSACTION');

        try {
            let updatedCount = 0;

            for (const position of positions) {
                if (!position.icao24) continue;

                const result = await db.run(`
                    INSERT INTO active_tracking (
                        icao24,
                        last_contact,
                        latitude,
                        longitude,
                        altitude,
                        velocity,
                        heading,
                        on_ground,
                        last_seen
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(icao24) DO UPDATE SET
                        last_contact = excluded.last_contact,
                        latitude = excluded.latitude,
                        longitude = excluded.longitude,
                        altitude = excluded.altitude,
                        velocity = excluded.velocity,
                        heading = excluded.heading,
                        on_ground = excluded.on_ground,
                        last_seen = CURRENT_TIMESTAMP;
                `, [
                    position.icao24,
                    position.last_contact,
                    position.latitude,
                    position.longitude,
                    position.altitude,
                    position.velocity,
                    position.heading,
                    position.on_ground ? 1 : 0
                ]) as unknown as SQLiteRunResult;

                if (result?.changes > 0) {
                    updatedCount++;
                }
            }

            await db.run('COMMIT');
            return updatedCount;
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    }) ?? 0;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    try {
        const { states } = req.body;

        if (!Array.isArray(states)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body: states must be an array'
            });
        }

        const updatedCount = await updatePositions(states);

        return res.status(200).json({
            success: true,
            message: `Updated ${updatedCount} aircraft positions`,
            updatedCount
        });

    } catch (error) {
        console.error('[OpenSky Update] Error:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Internal server error'
        });
    }
}
