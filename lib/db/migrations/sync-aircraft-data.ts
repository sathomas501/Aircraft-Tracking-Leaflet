// lib/db/migrations/sync-aircraft-data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveDb } from '@/lib/db/databaseManager';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';

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
        console.log('Starting aircraft data sync...');
        const db = await getActiveDb();

        // First, clear the aircraft table
        await db.run('DELETE FROM aircraft');
        console.log('Cleared aircraft table');

        // Insert data with column mapping
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
                aircraft_type,    -- mapped from 'TYPE AIRCRAFT'
                owner_type,       -- mapped from 'TYPE REGISTRANT'
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

        // Create indexes for better query performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer ON aircraft(manufacturer)',
            'CREATE INDEX IF NOT EXISTS idx_aircraft_model ON aircraft(model)',
            'CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft(icao24)',
            'CREATE INDEX IF NOT EXISTS idx_aircraft_type ON aircraft(aircraft_type)',
            'CREATE INDEX IF NOT EXISTS idx_aircraft_owner ON aircraft(owner_type)',
            'CREATE INDEX IF NOT EXISTS idx_aircraft_n_number ON aircraft("N-NUMBER")'
        ];

        for (const index of indexes) {
            await db.run(index);
        }
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

// Also export the verification function to use separately if needed
export async function verifySync() {
    const db = await getActiveDb();
    
    const sourceCount = await db.get('SELECT COUNT(*) as count FROM aircraft_data');
    const targetCount = await db.get('SELECT COUNT(*) as count FROM aircraft');
    
    console.log('Data verification:', {
        sourceRecords: sourceCount.count,
        syncedRecords: targetCount.count,
        syncPercentage: ((targetCount.count / sourceCount.count) * 100).toFixed(2) + '%'
    });

    // Sample manufacturer counts
    const mfgCounts = await db.all(`
        SELECT manufacturer, COUNT(*) as count
        FROM aircraft
        GROUP BY manufacturer
        ORDER BY count DESC
        LIMIT 5;
    `);
    console.log('Top manufacturers:', mfgCounts);
    
    return {
        sourceRecords: sourceCount.count,
        syncedRecords: targetCount.count,
        topManufacturers: mfgCounts
    };
}