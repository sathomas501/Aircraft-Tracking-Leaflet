// pages/api/aircraft/track-manufacturer.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ManufacturerTrackingService } from '@/lib/services/manufacturerTrackingService';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { openSkyService } from '@/lib/services/opensky';

interface TrackManufacturerResponse {
    success: boolean;
    manufacturer?: string;
    message: string;
    activeCount?: number;
    totalCount?: number;
    tracking?: boolean;
    currentManufacturer?: string;
    error?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TrackManufacturerResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    const { manufacturer } = req.body;
    if (!manufacturer) {
        return res.status(400).json({ 
            success: false, 
            message: 'Manufacturer is required' 
        });
    }

    try {
        const trackingService = ManufacturerTrackingService.getInstance();
        const currentlyTracking = trackingService.getCurrentManufacturer();

        // If already tracking this manufacturer, just return current status
        if (currentlyTracking === manufacturer) {
            const counts = await openSkyService.getActiveCount(manufacturer);
            return res.status(200).json({
                success: true,
                manufacturer,
                message: `Already tracking aircraft for ${manufacturer}`,
                activeCount: counts.active,
                totalCount: counts.total,
                tracking: true,
                currentManufacturer: manufacturer
            });
        }

        // Start tracking new manufacturer
        await trackingService.startTracking(manufacturer);
        const counts = await openSkyService.getActiveCount(manufacturer);

        console.log(`Started tracking aircraft for manufacturer: ${manufacturer}`);

        return res.status(200).json({
            success: true,
            manufacturer,
            message: `Now tracking aircraft for ${manufacturer}`,
            activeCount: counts.active,
            totalCount: counts.total,
            tracking: trackingService.isTracking(),
            currentManufacturer: manufacturer
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        errorHandler.handleError(ErrorType.DATA, `Failed to track manufacturer: ${errorMessage}`);
        
        return res.status(500).json({ 
            success: false,
            message: 'Failed to start tracking manufacturer',
            error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        });
    }
}