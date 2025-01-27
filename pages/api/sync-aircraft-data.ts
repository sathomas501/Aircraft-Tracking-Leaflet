import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/db/databaseManager';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        console.log('Starting aircraft data sync...');
        const db = await getDatabase();

        // Check if source table has data
        const sourceRowCount = await db.get(`SELECT COUNT(*) as count FROM aircraft_data`);
        if (sourceRowCount.count === 0) {
            return res.status(400).json({
                success: false,
                message: 'No data available to sync from aircraft_data table'
            });
        }

        // Clear the aircraft table
        await db.run('DELETE FROM aircraft');
        console.log('Cleared aircraft table');

        // Insert data
        const insertQuery = `
            INSERT INTO aircraft (
                icao24,
                "N-NUMBER",
                manufacturer,
                model,
                operator,
                NAME,
                CITY,
                STATE,
                aircraft_type,
                owner_type,
                created_at,
                updated_at
            )
            SELECT 
                icao24,
                "N-NUMBER",
                manufacturer,
                model,
                operator,
                NAME,
                CITY,
                STATE,
                "TYPE AIRCRAFT" as aircraft_type,
                "TYPE REGISTRANT" as owner_type,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM aircraft_data
            WHERE manufacturer IS NOT NULL
            AND LENGTH(TRIM(manufacturer)) > 1;
        `;
        const result = await db.run(insertQuery);
        console.log(`Synced ${result.changes} records to aircraft table`);

        // Create indexes within a transaction
        const indexes = [
            'CREATE INDEX IF NOT EXISTS aircraft_idx_manufacturer ON aircraft(manufacturer)',
            'CREATE INDEX IF NOT EXISTS aircraft_idx_model ON aircraft(model)',
            'CREATE INDEX IF NOT EXISTS aircraft_idx_icao24 ON aircraft(icao24)',
            'CREATE INDEX IF NOT EXISTS aircraft_idx_type ON aircraft(aircraft_type)',
            'CREATE INDEX IF NOT EXISTS aircraft_idx_owner ON aircraft(owner_type)',
            'CREATE INDEX IF NOT EXISTS aircraft_idx_n_number ON aircraft("N-NUMBER")'
        ];
        await db.run('BEGIN TRANSACTION');
        for (const index of indexes) {
            await db.run(index);
        }
        await db.run('COMMIT');
        console.log('Created indexes');

        // Get statistics
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT manufacturer) as manufacturers,
                COUNT(DISTINCT model) as models,
                COUNT(DISTINCT aircraft_type) as types,
                COUNT(DISTINCT owner_type) as owner_types
            FROM aircraft;
        `);

        return res.status(200).json({
            success: true,
            message: 'Aircraft data sync completed successfully',
            stats,
            recordsSynced: result.changes
        });

    } catch (error) {
        console.error('Error syncing aircraft data:', error);
        
        errorHandler.handleError(
            ErrorType.DATA,
            'Failed to sync aircraft data',
            error instanceof Error ? error : new Error('Unknown error')
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to sync aircraft data',
            error: process.env.NODE_ENV === 'development' 
                ? (error instanceof Error ? error.message : 'Unknown error') 
                : 'Internal server error'
        });
    }
}
