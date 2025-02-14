import type { NextApiRequest, NextApiResponse } from 'next';
import CacheManager from '@/lib/services/managers/cache-manager';

const cache = new CacheManager<string[]>(5 * 60); // 5-minute ICAO24 cache

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Aircraft Positions] Received Request:', req.method, req.query);

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ error: 'Method Not Allowed. Use GET instead.' });
  }

  let { icao24List, manufacturer } = req.query;

  if (!icao24List && !manufacturer) {
    return res.status(400).json({
      error: 'Either icao24List or manufacturer parameter is required',
    });
  }

  let icao24String: string;

  if (manufacturer) {
    const cachedIcao24s = cache.get(manufacturer as string);

    if (cachedIcao24s) {
      console.log(
        `[Aircraft Positions] ✅ Using cached ICAO24s for ${manufacturer}`
      );
      icao24String = cachedIcao24s.join(',');
    } else {
      return res.status(400).json({
        error: `ICAO24s for manufacturer ${manufacturer} not found in cache.`,
      });
    }
  } else {
    icao24String = Array.isArray(icao24List)
      ? icao24List.join(',')
      : (icao24List as string);
  }

  // Use the proxy instead of direct OpenSky requests
  const proxyUrl = `http://localhost:3001/api/proxy/opensky?icao24=${icao24String}`;
  console.log(`[Aircraft Positions] Forwarding request to Proxy: ${proxyUrl}`);

  try {
    const response = await fetch(proxyUrl, { method: 'GET' });

    if (!response.ok) {
      console.error(
        '[Aircraft Positions] Proxy Response Error:',
        response.status,
        response.statusText
      );
      return res
        .status(response.status)
        .json({ error: 'Proxy request failed' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Aircraft Positions] Error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch aircraft positions from proxy' });
  }
}
