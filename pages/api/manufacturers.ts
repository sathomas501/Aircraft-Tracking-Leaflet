// pages/api/manufacturers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveDb, runQuery } from '@/lib/db/databaseManager';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';

interface ManufacturerData {
    name: string;
    count: number;
    activeCount: number;
}

interface ManufacturerResponse {
    value: string;
    label: string;
    count: number;
    activeCount: number;
}

export default async function handler(
    req: NextApiRequest, 
    res: NextApiResponse<{ manufacturers: ManufacturerResponse[] } | { error: string; message?: string }>
) {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const attemptQuery = async (): Promise<ManufacturerData[]> => {
        try {
            console.log(`Query attempt ${retryCount + 1} of ${maxRetries}`);
            
            // Get database connection
            const db = await getActiveDb();
            console.log('Database connection established');

            // Configure busy timeout for this connection
            await db.exec('PRAGMA busy_timeout = 30000;'); // 30 seconds
            
            // Main query with optimized conditions
            const manufacturers = await db.all<ManufacturerData[]>(`
                SELECT 
                    manufacturer as name,
                    COUNT(*) as count,
                    SUM(CASE 
                        WHEN is_active = 1 
                        AND last_contact >= unixepoch('now') - 7200 
                        THEN 1 
                        ELSE 0 
                    END) as activeCount
                FROM aircraft
                WHERE 
                    manufacturer IS NOT NULL
                    AND manufacturer != ''
                    AND LENGTH(TRIM(manufacturer)) > 1
                GROUP BY manufacturer
                HAVING count >= 10
                ORDER BY count DESC
                LIMIT 50
            `);

            console.log(`Found ${manufacturers.length} manufacturers`);
            return manufacturers;
            
        } catch (error) {
            if (error instanceof Error && 
                error.message.includes('SQLITE_BUSY') && 
                retryCount < maxRetries) {
                
                retryCount++;
                console.log(`Database busy, retrying in ${retryDelay}ms... (Attempt ${retryCount} of ${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return attemptQuery();
            }
            throw error;
        }
    };

    try {
        if (req.method !== 'GET') {
            res.setHeader('Allow', ['GET']);
            return res.status(405).json({ 
                error: 'Method Not Allowed',
                message: `Method ${req.method} is not allowed` 
            });
        }

        console.log('Starting manufacturers fetch...');
        
        const manufacturers = await attemptQuery();

        if (!Array.isArray(manufacturers)) {
            throw new Error('Invalid response from database');
        }

        const formattedManufacturers = manufacturers.map((m: ManufacturerData) => ({
            value: m.name,
            label: m.name,
            count: Number(m.count) || 0,
            activeCount: Number(m.activeCount) || 0
        }));

        console.log('Successfully formatted manufacturers data');

        return res.status(200).json({ manufacturers: formattedManufacturers });
        
    } catch (error) {
        console.error('Detailed error in manufacturers API:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            retryAttempts: retryCount
        });

        errorHandler.handleError(
            ErrorType.DATA,
            'Failed to fetch manufacturers',
            error instanceof Error ? error : new Error('Unknown error')
        );
        
        return res.status(500).json({ 
            error: 'Failed to fetch manufacturers',
            message: process.env.NODE_ENV === 'development' 
                ? (error instanceof Error ? error.message : 'Unknown error') 
                : 'Internal server error'
        });
    }
}