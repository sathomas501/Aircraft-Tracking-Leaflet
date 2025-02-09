// pages/api/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
import { OpenSkyError, OpenSkyErrorCode } from '@/lib/services/error-handler';
import { API_CONFIG } from '@/config/api';
import { processBatchedRequests } from '@/utils/batchprocessor';

async function fetchAllAircraftStates(icao24List: string[]): Promise<any[]> {
  // Get the base URL from environment or default to localhost
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  console.log(`Starting to fetch states for ${icao24List.length} aircraft`);

  try {
    return await processBatchedRequests(
      icao24List,
      async (batch) => {
        console.log(`Making request for batch of ${batch.length} aircraft`);

        // Use absolute URL for server-side requests
        const response = await fetch(`${baseUrl}/api/proxy/opensky`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ icao24s: batch }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `OpenSky API error: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();
        console.log(
          `Received data for ${data.states?.length || 0} aircraft states`
        );
        return data.states || [];
      },
      API_CONFIG.PARAMS.MAX_ICAO_QUERY,
      {
        timeout: 30000, // Increased timeout
        retries: 3, // Reduced retries
        retryDelay: 2000, // Increased delay between retries
      }
    );
  } catch (error) {
    console.error('Error fetching aircraft states:', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('📡 [API] ICAO24s endpoint called:', {
    method: req.method,
    body: req.body,
    query: req.query,
  });

  try {
    const manufacturer =
      req.method === 'POST'
        ? req.body.manufacturer
        : (req.query.manufacturer as string);

    if (!manufacturer) {
      throw new OpenSkyError(
        'Manufacturer query parameter is required',
        OpenSkyErrorCode.VALIDATION,
        400
      );
    }

    await databaseManager.initializeDatabase();

    const query = `
      SELECT DISTINCT icao24
      FROM aircraft
      WHERE manufacturer = ?
      AND icao24 IS NOT NULL
      AND icao24 != ''
      LIMIT ${API_CONFIG.PARAMS.MAX_TOTAL_ICAO_QUERY}
    `;

    const results: { icao24: string }[] = await databaseManager.executeQuery(
      query,
      [manufacturer]
    );

    const icao24List = results.map((item) => item.icao24);
    const openSkyData = await fetchAllAircraftStates(icao24List);

    return res.status(200).json({
      success: true,
      message: `Processed ${results.length} ICAO24 codes for ${manufacturer}`,
      data: {
        aircraft: openSkyData,
        meta: {
          total: results.length,
          manufacturer,
          timestamp: new Date().toISOString(),
          batches: Math.ceil(
            icao24List.length / API_CONFIG.PARAMS.MAX_ICAO_QUERY
          ),
        },
      },
    });
  } catch (error) {
    console.error('❌ [API] Error:', error);

    if (error instanceof OpenSkyError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        data: {
          aircraft: [],
          meta: {
            total: 0,
            manufacturer: '',
            timestamp: new Date().toISOString(),
            batches: 0,
          },
        },
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: {
        aircraft: [],
        meta: {
          total: 0,
          manufacturer: '',
          timestamp: new Date().toISOString(),
          batches: 0,
        },
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
