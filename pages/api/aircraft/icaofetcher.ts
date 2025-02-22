import type { NextApiRequest, NextApiResponse } from 'next';
import CacheManager from '@/lib/services/managers/cache-manager';
import { processBatchedRequests } from '../../../utils/batchprocessor';

const cache = new CacheManager<string[]>(2 * 60);
const BATCH_SIZE = 200;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[ICAOFetcher] 📡 Received Request:', req.method);

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ error: 'Method Not Allowed. Use POST instead.' });
  }

  const { icao24s } = req.body;

  if (!icao24s || !Array.isArray(icao24s) || icao24s.length === 0) {
    console.error('[ICAOFetcher] ❌ Invalid or missing ICAO24 list');
    return res.status(400).json({ error: 'Invalid ICAO24 list' });
  }

  console.log(
    `[ICAOFetcher] 🔄 Processing ${icao24s.length} ICAO24s before sending to proxy`
  );

  try {
    const batchProcessor = async (batch: string[]) => {
      console.log(
        `[ICAOFetcher] 🚀 Sending batch of ${batch.length} ICAO24s to OpenSky Proxy`
      );

      // Convert batch to URL query parameters for GET request
      const icao24Param = batch.join(',');
      const proxyUrl = `http://localhost:3001/api/proxy/opensky?icao24=${encodeURIComponent(icao24Param)}`;

      const response = await fetch(proxyUrl, {
        method: 'GET', // Use GET for OpenSky
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Proxy Request Failed: ${response.statusText}`);
      }

      return await response.json();
    };

    const results = await processBatchedRequests(
      icao24s,
      batchProcessor,
      BATCH_SIZE
    );

    console.log(
      `[ICAOFetcher] ✅ Successfully processed ${icao24s.length} ICAO24s in batches`
    );

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('[ICAOFetcher] ❌ Error processing ICAO24s:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch aircraft positions from OpenSky' });
  }
}
