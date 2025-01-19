// pages/api/aircraft/track-manufacturer.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ManufacturerTrackingService } from '@/lib/services/manufacturerTrackingService';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { getActiveDb } from '@/lib/db/databaseManager';
import { PositionData } from '@/types/base';
import { Database } from 'sqlite';
import { positionUpdateService } from '@/lib/services/positionalUpdateService';

interface AircraftPosition {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground?: boolean;
    last_contact: number;
}

interface TrackerResponse {
    success: boolean;
    manufacturer?: string;
    message: string;
    activeCount?: number;
    totalCount?: number;
    positions?: AircraftPosition[];
    tracking?: boolean;
    error?: string;
}

async function getPositionsWithTimeout(
    trackingService: ManufacturerTrackingService,
    icao24List: string[],
    timeout: number = 15000
): Promise<PositionData[]> {
    const timeoutPromise = new Promise<PositionData[]>((_, reject) => {
        setTimeout(() => reject(new Error('Position fetch timeout')), timeout);
    });

    try {
        return await Promise.race([
            trackingService.getActiveAircraft(icao24List),
            timeoutPromise
        ]);
    } catch (error) {
        console.error('[WebSocket] Position fetch error:', error);
        return [];
    }
}

function validateAndConvertPosition(pos: PositionData): AircraftPosition | null {
    if (
        typeof pos.icao24 === 'string' &&
        typeof pos.latitude === 'number' &&
        typeof pos.longitude === 'number' &&
        typeof pos.altitude === 'number' &&
        typeof pos.velocity === 'number' &&
        typeof pos.heading === 'number' &&
        typeof pos.last_contact === 'number'
    ) {
        return {
            icao24: pos.icao24,
            latitude: pos.latitude,
            longitude: pos.longitude,
            altitude: pos.altitude,
            velocity: pos.velocity,
            heading: pos.heading,
            on_ground: pos.on_ground,
            last_contact: pos.last_contact
        };
    }
    return null;
}

async function markAircraftActive(db: Database, positions: AircraftPosition[]): Promise<void> {
    if (positions.length === 0) return;

    const placeholders = positions.map(() => '?').join(',');
    const query = `
        UPDATE aircraft 
        SET active = 1, 
            last_seen = CURRENT_TIMESTAMP
        WHERE icao24 IN (${placeholders})
    `;

    const icao24s = positions.map(pos => pos.icao24);
    await db.run(query, icao24s);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TrackerResponse>
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
        console.log(`[${new Date().toISOString()}] Starting tracking for manufacturer: ${manufacturer}`);
        
        const db = await getActiveDb();

        // Get ICAO24s for the manufacturer
        const query = `
            SELECT DISTINCT a.icao24
            FROM aircraft a
            WHERE a.manufacturer = ?
            AND a.icao24 IS NOT NULL
            AND LENGTH(TRIM(a.icao24)) > 0
            ${model ? 'AND a.model = ?' : ''}
        `;
        
        const params = model ? [manufacturer, model] : [manufacturer];
        const aircraft = await db.all<{ icao24: string }[]>(query, params);

        if (!aircraft || aircraft.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No aircraft found for ${manufacturer}`,
                activeCount: 0
            });
        }

        const icao24List = aircraft.map(a => a.icao24);
        console.log(`[Progress] Found ${icao24List.length} total aircraft to check`);

        // Clear existing active status
        console.log('[Database] Clearing stale active statuses');
        const clearQuery = `
            UPDATE aircraft 
            SET active = 0, last_seen = NULL 
            WHERE manufacturer = ? 
            AND (last_seen < datetime('now', '-2 hours') OR last_seen IS NULL)
        `;
        await db.run(clearQuery, [manufacturer]);
        console.log('[Database] Cleared stale statuses');

        // Initialize tracking service
        console.log('[Tracking] Initializing tracking service');
        const trackingService = ManufacturerTrackingService.getInstance();
        await trackingService.startTracking(manufacturer);
        
        // Get currently active positions
        console.log('[WebSocket] Fetching active positions');
        const rawPositions = await getPositionsWithTimeout(trackingService, icao24List);
        const positions = rawPositions
            .map(validateAndConvertPosition)
            .filter((pos): pos is AircraftPosition => pos !== null);
            
        console.log(`[Progress] Found ${positions.length} valid active aircraft`);

        // Mark aircraft as active and start position updates
        if (positions.length > 0) {
            console.log('[Database] Marking active aircraft');
            await markAircraftActive(db, positions);
            console.log(`[Database] Marked ${positions.length} aircraft as active`);
        }

        // Start continuous position updates
        positionUpdateService.start();

        // Get final counts
        const countQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN active = 1 AND last_seen > datetime('now', '-2 hours') THEN 1 ELSE 0 END) as active
            FROM aircraft
            WHERE manufacturer = ?
        `;
        
        const counts = await db.get<{ total: number; active: number }>(countQuery, [manufacturer]);
        console.log('[Complete] Final counts:', counts);

        return res.status(200).json({
            success: true,
            manufacturer,
            message: `Now tracking aircraft for ${manufacturer}`,
            activeCount: counts?.active || 0,
            totalCount: counts?.total || 0,
            positions,
            tracking: true
        });

    } catch (error) {
        console.error('[Error] Error in track-manufacturer API:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        errorHandler.handleError(ErrorType.DATA, `Failed to track manufacturer: ${errorMessage}`);
        
        return res.status(500).json({ 
            success: false,
            message: 'Failed to start tracking manufacturer',
            error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        });
    }
}