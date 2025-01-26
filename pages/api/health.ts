<<<<<<< HEAD
import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveDb } from '@/lib/db/trackingDatabaseManager';

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
        const db = await getActiveDb();
        if (!db) {
            throw new Error('No active database connection');
        }

        // Run a simple query to verify the database connection
        await db.get('SELECT 1');

        res.status(200).json({
            status: 'healthy',
            message: 'Database connection successful'
        });
=======
// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveDb } from '@/lib/db/databaseManager';

const db = await getActiveDb();


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const db = await getActiveDb();
        await db.get('SELECT 1');
        res.status(200).json({ status: 'healthy', message: 'Database connection successful' });
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            message: 'Database connection failed',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
<<<<<<< HEAD
}
=======
}
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6
