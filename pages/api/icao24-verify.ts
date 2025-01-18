// pages/api/icao24-verify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getActiveDb } from '@/lib/db/databaseManager';
import axios from 'axios';

const db = await getActiveDb();

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const db = await getActiveDb();
        
        // First, let's check all available manufacturers
        const manufacturersQuery = `
            SELECT manufacturer, COUNT(*) as count
            FROM aircraft
            WHERE manufacturer LIKE '%BOEING%'
            GROUP BY manufacturer
            ORDER BY count DESC;
        `;
        
        const manufacturers = await db.all(manufacturersQuery);
        console.log('Available Boeing manufacturers:', manufacturers);

        // Then query for Boeing aircraft
        const query = `
            SELECT DISTINCT icao24, manufacturer, model
            FROM aircraft
            WHERE manufacturer LIKE '%BOEING%'
            AND icao24 IS NOT NULL
            AND icao24 != ''
            LIMIT 50;
        `;

        const aircraft = await db.all(query);
        console.log(`Found ${aircraft.length} Boeing aircraft`);

        // Test first 10 Boeing aircraft with OpenSky
        const testBatch = aircraft.slice(0, 10);
        const testIcao24s = testBatch.map(a => a.icao24.toLowerCase()).join(',');

        console.log('Testing OpenSky with Boeing ICAO24s:', testIcao24s);

        const openSkyResponse = await axios.get(
            `https://opensky-network.org/api/states/all?icao24=${testIcao24s}`,
            {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        return res.status(200).json({
            success: true,
            data: {
                manufacturers: manufacturers,
                databaseResults: {
                    total: aircraft.length,
                    testedAircraft: testBatch
                },
                openSkyResults: {
                    queriedIcao24s: testIcao24s,
                    response: openSkyResponse.data,
                    time: openSkyResponse.data?.time ? 
                          new Date(openSkyResponse.data.time * 1000).toISOString() : 
                          null
                }
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error in icao24-verify:', error);
        return res.status(500).json({
            success: false,
            error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                type: error instanceof Error ? error.name : 'Unknown',
                details: error instanceof Error ? error.stack : null,
                isAxiosError: axios.isAxiosError(error),
                response: axios.isAxiosError(error) ? {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                } : null
            }
        });
    }
}