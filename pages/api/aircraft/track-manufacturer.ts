// pages/api/aircraft/track-manufacturer.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ManufacturerTrackingService } from '@/lib/services/manufacturerTrackingService';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { getActiveDb } from '@/lib/db/databaseManager';

const db = await getActiveDb();


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

    const { manufacturer, model } = req.body;

    if (!manufacturer) {
        return res.status(400).json({ 
            success: false, 
            message: 'Manufacturer is required' 
        });
    }

    try {
        console.log(`Starting tracking for manufacturer: ${manufacturer}`);
        
        // Get ICAO24s directly from the database
        const db = await getActiveDb();
        let query = `
            SELECT DISTINCT icao24
            FROM aircraft
            WHERE manufacturer = ?
            AND icao24 IS NOT NULL
            AND LENGTH(TRIM(icao24)) > 0
        `;
        
        const params = [manufacturer];

        // Add model filter if provided
        if (model) {
            query += ` AND model = ?`;
            params.push(model);
        }

        const aircraft = await db.all(query, params);
        const icao24List = aircraft.map(a => a.icao24);

        if (!icao24List || icao24List.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No aircraft found for ${manufacturer}`,
                activeCount: 0
            });
        }

        console.log(`Found ${icao24List.length} aircraft to check`);

        // Start tracking service
        const trackingService = ManufacturerTrackingService.getInstance();
        await trackingService.startTracking(manufacturer);

        // Get initial active positions
        const positions = await trackingService.getActiveAircraft(icao24List);
        const activeCount = positions.length;

        console.log(`Found ${activeCount} active aircraft`);

        return res.status(200).json({
            success: true,
            manufacturer,
            message: `Now tracking aircraft for ${manufacturer}`,
            activeCount,
            totalCount: icao24List.length,
            positions,
            tracking: true
        });

    } catch (error) {
        console.error('Error in track-manufacturer API:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        errorHandler.handleError(ErrorType.DATA, `Failed to track manufacturer: ${errorMessage}`);
        
        return res.status(500).json({ 
            success: false,
            message: 'Failed to start tracking manufacturer',
            error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        });
    }
}

