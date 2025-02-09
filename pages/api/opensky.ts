import type { NextApiRequest, NextApiResponse } from 'next';
import { openSkyAuth } from '@/lib/services/opensky-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, params } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Missing request type' });
    }

    console.log(`📡 OpenSky Proxy API request: ${type}, params:`, params);

    let result;

    switch (type) {
      case 'icao24':
        if (!params || !params.icao24s) {
          throw new Error('Missing ICAO24 list for aircraft lookup');
        }
        result = await fetchAircraftByIcao24s(params.icao24s);
        break;

      case 'arrivals':
      case 'departures':
      case 'flights':
        result = await fetchOpenSkyData(type, params);
        break;

      default:
        return res.status(400).json({ error: 'Invalid request type' });
    }

    return res.status(200).json({ data: result });
  } catch (error) {
    console.error('❌ OpenSky Proxy API error:', error);
    res.status(500).json({
      error: 'Failed to fetch OpenSky data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ✅ Fetches ICAO24s through the proxy API
async function fetchAircraftByIcao24s(icao24s: string[]) {
  console.log('🔍 Fetching aircraft data for ICAO24s via proxy:', icao24s);

  const response = await fetch(
    `/api/proxy/opensky?icao24s=${icao24s.join(',')}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Proxy API Error: ${response.statusText}`);
  }

  return await response.json();
}

// ✅ Fetches generalized OpenSky data via the proxy
async function fetchOpenSkyData(type: string, params: any) {
  const isAuthenticated = await openSkyAuth.ensureAuthenticated();
  if (!isAuthenticated) {
    throw new Error('Authentication to OpenSky failed');
  }

  const proxyUrl = `/api/proxy/opensky?type=${type}`;

  console.log(`🚀 Fetching OpenSky ${type} data via proxy:`, proxyUrl);

  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...openSkyAuth.getAuthHeaders(),
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Proxy API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Proxy fetch error for ${type}:`, error);
    throw error;
  }
}
