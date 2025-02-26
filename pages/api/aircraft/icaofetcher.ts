import type { NextApiRequest, NextApiResponse } from 'next';
import { processBatchedRequests } from '../../../utils/batchprocessor';

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
    `[ICAOFetcher] 🔄 Processing ${icao24s.length} ICAOs in batches of ${BATCH_SIZE}`
  );

  try {
    // ✅ Process ICAOs in batches and call the proxy
    const batchResults = await processBatchedRequests(
      icao24s,
      async (batch) => {
        console.log(
          `[ICAOFetcher] 📦 Sending batch of ${batch.length} ICAOs to OpenSky proxy...`
        );

        // ✅ Now calling the proxy, not OpenSky directly
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/proxy/opensky`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ icao24s: batch }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `[ICAOFetcher] ❌ OpenSky Proxy Error: ${response.statusText}`
          );
        }

        return response.json();
      },
      BATCH_SIZE
    );

    // Flatten the results
    const freshAircraft = batchResults.flat();

    if (freshAircraft.length === 0) {
      console.log('[ICAOFetcher] ❌ No data found from OpenSky');
      return res.status(204).end(); // 204 No Content
    }

    // Extract the ICAOs
    const freshICAOs = freshAircraft.map((ac: any) => ac.icao24);

    return res.status(200).json({ data: freshICAOs });
  } catch (error) {
    console.error('[ICAOFetcher] ❌ Error fetching ICAO24 data:', error);
    return res.status(500).json({ error: 'Failed to fetch ICAO24 data' });
  }
}
