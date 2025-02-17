// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import StaticDatabaseManager from '@/lib/db/databaseManager';
import { OpenSkyState, OpenSkyStateArray } from '@/types/base';

interface BatchResponse {
  data?: {
    states?: OpenSkyState[];
    timestamp?: number;
    meta?: {
      total: number;
      requestedIcaos: number;
    };
  };
  success: boolean;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[ICAO24 API] 📡 Received Request: ${req.method}`);

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method Not Allowed. Use POST.' });
  }

  const { manufacturer } = req.body;

  if (!manufacturer || typeof manufacturer !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Manufacturer parameter is required',
    });
  }

  console.log(
    `[ICAO24 API] 🔄 Fetching ICAO24s from STATIC database for manufacturer: ${manufacturer}`
  );

  try {
    if (!StaticDatabaseManager.isReady) {
      console.log('[ICAO24 API] 🔄 Initializing Static Database...');
      await StaticDatabaseManager.initializeDatabase();
    }

    const query = `
      SELECT DISTINCT icao24
      FROM aircraft
      WHERE manufacturer = ?
      AND icao24 IS NOT NULL AND icao24 != ''
      AND LENGTH(icao24) = 6
      AND LOWER(icao24) GLOB '[0-9a-f]*'
      ORDER BY icao24
    `;

    const results = await StaticDatabaseManager.executeQuery<{
      icao24: string;
    }>(query, [manufacturer]);

    const icao24List = results
      .map((item) => item.icao24.toLowerCase())
      .filter((icao24) => /^[0-9a-f]{6}$/.test(icao24));

    if (icao24List.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          icao24List: [],
          states: [],
          timestamp: Date.now(),
          meta: {
            total: 0,
            requestedIcaos: 0,
          },
        },
      });
    }

    console.log(
      `[ICAO24 API] ✅ Retrieved ${icao24List.length} ICAO24s. Forwarding to ICAOFetcher...`
    );

    // Forward to ICAOFetcher
    const fetcherResponse = await fetch(
      'http://localhost:3001/api/aircraft/icaofetcher',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24List }),
      }
    );

    if (!fetcherResponse.ok) {
      throw new Error(`ICAOFetcher failed: ${fetcherResponse.statusText}`);
    }

    const fetcherData = await fetcherResponse.json();

    // Consolidate the batch responses
    const consolidatedStates: OpenSkyState[] = [];
    let latestTimestamp = 0;
    let totalAircraft = 0;

    if (Array.isArray(fetcherData.data)) {
      fetcherData.data.forEach((batch: BatchResponse) => {
        if (batch.data?.states) {
          consolidatedStates.push(...batch.data.states);
          latestTimestamp = Math.max(
            latestTimestamp,
            batch.data.timestamp || 0
          );
          totalAircraft += batch.data.meta?.total || 0;
        }
      });
    }

    console.log(
      `[ICAO24 API] ✅ Consolidated ${consolidatedStates.length} states from ${fetcherData.data?.length || 0} batches`
    );

    return res.status(200).json({
      success: true,
      data: {
        icao24List,
        states: consolidatedStates,
        timestamp: latestTimestamp || Date.now(),
        meta: {
          total: totalAircraft,
          requestedIcaos: icao24List.length,
        },
      },
    });
  } catch (error) {
    console.error('[ICAO24 API] ❌ Error processing ICAO24s:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch ICAO24s',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default handler;
