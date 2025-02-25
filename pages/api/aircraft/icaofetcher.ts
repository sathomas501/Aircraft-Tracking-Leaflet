import type { NextApiRequest, NextApiResponse } from 'next';
import CacheManager from '@/lib/services/managers/cache-manager';
import { processBatchedRequests } from '../../../utils/batchprocessor';
import { OpenSkySyncService } from '@/lib/services/openSkySyncService'; // ✅ Added OpenSky API

const cache = new CacheManager<string[]>(2 * 60); // Cache for 2 minutes
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

  // ✅ Fetch fresh data from OpenSky if cache is missing or outdated
  const cachedResults = cache.get('icao24_results');
  if (cachedResults && cachedResults.length > 0) {
    console.log('[ICAOFetcher] ⚡ Returning cached results');
    return res.status(200).json({ data: cachedResults });
  }

  console.log('[ICAOFetcher] 🆕 Fetching fresh ICAO24 data from OpenSky...');

  try {
    const openSkySyncService = OpenSkySyncService.getInstance();
    const freshAircraft = await openSkySyncService.fetchLiveAircraft(icao24s);

    if (freshAircraft.length === 0) {
      console.log('[ICAOFetcher] ❌ No data found from OpenSky');
      return res.status(204).json({ data: [] });
    }

    const freshICAOs = freshAircraft.map((ac) => ac.icao24);

    // ✅ Store new data in cache
    cache.set('icao24_results', freshICAOs);

    return res.status(200).json({ data: freshICAOs });
  } catch (error) {
    console.error('[ICAOFetcher] ❌ Error fetching ICAO24 data:', error);
    return res.status(500).json({ error: 'Failed to fetch ICAO24 data' });
  }
}
