// pages/api/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { openSkyService } from '@/lib/services/opensky';
import { API_PARAMS } from '@/lib/api/constants';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle WebSocket upgrade
  if (req.method === 'GET' && (req as any).socket?.server && req.url?.includes('/api/opensky')) {
    return res.status(426).json({ message: 'Upgrade Required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `HTTP method ${req.method} is not supported.`
    });
  }

  const { [API_PARAMS.ICAO24S]: icao24s } = req.query;
  
  if (!icao24s) {
    return res.status(400).json({ 
      error: `Missing ${API_PARAMS.ICAO24S} parameter` 
    });
  }

  try {
    const icaoList = typeof icao24s === 'string' 
      ? icao24s.split(',')
      : Array.isArray(icao24s) 
        ? icao24s 
        : [icao24s];

    console.log('Fetching positions for', icaoList.length, 'aircraft');
    const positions = await openSkyService.getPositions(icaoList);
    
    console.log('Retrieved positions for', positions.length, 'aircraft');
    res.status(200).json(positions);
  } catch (error) {
    console.error('OpenSky API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from OpenSky',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}