// pages/api/opensky-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const TEST_ICAO24S = [
    'a835af',  // Original test
    'a0f1bb',  // Usually active commercial
    'a4c4a3',  // Usually active commercial
    'abc123',  // Test code
    '424588',  // Another common active
    'a19d1f'   // Another test
];

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    console.log('Test request received');

    try {
        // Test with multiple ICAO24 codes
        const response = await axios.get(
            `https://opensky-network.org/api/states/all?icao24=${TEST_ICAO24S.join(',')}`,
            {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        console.log('OpenSky test response:', {
            status: response.status,
            hasData: !!response.data,
            states: response.data?.states?.length || 0,
            time: new Date(response.data?.time * 1000).toISOString()
        });

        // Process the response data
        const processedData = response.data?.states?.map((state: any[]) => ({
            icao24: state[0],
            longitude: state[5],
            latitude: state[6],
            altitude: state[7],
            onGround: state[8],
            velocity: state[9]
        })) || [];

        res.status(200).json({
            success: true,
            data: {
                raw: response.data,
                processed: processedData,
                queriedIcao24s: TEST_ICAO24S
            },
            meta: {
                timestamp: new Date().toISOString(),
                responseStatus: response.status,
                activeAircraft: processedData.length
            }
        });

    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}