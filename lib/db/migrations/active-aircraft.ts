//lib/db/migrations

import { db, runQuery, getQuery } from '../connection';

async function columnExists(table: string, column: string): Promise<boolean> {
    const query = `
        SELECT COUNT(*) as count
        FROM pragma_table_info(?)
        WHERE name = ?;
    `;
    const result = await getQuery(query, [table, column]);
    return result?.count > 0;
}

export async function addActiveAircraftColumns() {
    try {
        // Define columns to add
        const columns = [
            { name: 'active', type: 'BOOLEAN DEFAULT 0' },
            { name: 'last_seen', type: 'TIMESTAMP' },
            { name: 'latitude', type: 'REAL' },
            { name: 'longitude', type: 'REAL' },
            { name: 'altitude', type: 'REAL' },
            { name: 'velocity', type: 'REAL' },
            { name: 'heading', type: 'REAL' },
        ];

        // Add columns if they don't exist
        for (const { name, type } of columns) {
            const exists = await columnExists('aircraft', name);
            if (!exists) {
                await runQuery(`ALTER TABLE aircraft ADD COLUMN ${name} ${type}`);
                console.log(`Added column: ${name}`);
            }
        }

        // Create indexes
        const indexes = [
            { name: 'idx_aircraft_active', query: 'CREATE INDEX IF NOT EXISTS idx_aircraft_active ON aircraft(active)' },
            { name: 'idx_aircraft_manufacturer_active', query: 'CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer_active ON aircraft(manufacturer, active)' },
            { name: 'idx_aircraft_last_seen', query: 'CREATE INDEX IF NOT EXISTS idx_aircraft_last_seen ON aircraft(last_seen)' },
            { name: 'idx_aircraft_model_active', query: 'CREATE INDEX IF NOT EXISTS idx_aircraft_model_active ON aircraft(model, active)' },
        ];

        for (const { name, query } of indexes) {
            await runQuery(query);
            console.log(`Index created or already exists: ${name}`);
        }

        console.log('Columns and indexes added successfully.');
    } catch (err) {
        console.error('Error adding columns or indexes:', err);
    }
}

export async function cleanup() {
    try {
        const query = `
            UPDATE aircraft
            SET active = 0, 
                last_seen = NULL
            WHERE last_seen < datetime('now', '-2 hours')
            OR last_seen IS NULL;
        `;
        await runQuery(query);
        console.log('Cleanup completed successfully.');
    } catch (err) {
        console.error('Error during cleanup:', err);
    }
}
