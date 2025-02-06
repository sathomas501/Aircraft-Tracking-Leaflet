import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/trackingDatabaseManager';

interface HealthResponse {
    status: 'healthy' | 'unhealthy';
    message: string;
    error?: unknown;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<HealthResponse>
) {
    console.log('Health check accessed');
    try {
        // Get the singleton instance of the TrackingDatabaseManager
        const db = TrackingDatabaseManager.getInstance();
        await db.initialize(); // Ensure the database is initialized

        // Run a simple query to verify the database connection
        await db.executeQuery('SELECT 1');

        res.status(200).json({
            status: 'healthy',
            message: 'Database connection successful',
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            message: 'Database connection failed',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}
