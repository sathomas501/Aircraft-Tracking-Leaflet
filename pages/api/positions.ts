// pages/api/clientpositions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { unifiedCache } from '../../lib/services/managers/unified-cache-system';

interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const key = 'opensky_positions';

    // Check cache first
    const cachedData = unifiedCache.getLiveData(key);
    if (cachedData) {
      return res.status(200).json({ positions: cachedData });
    }

    // Fetch live data from OpenSky API
    const response = await fetch('https://opensky-network.org/api/states/all');
    const data = await response.json();

    if (!data.states) {
      throw new Error('No live data received from OpenSky.');
    }

    // Map the data to a usable format
    const positions = data.states.map((state: OpenSkyState) => ({
      icao24: state.icao24,
      latitude: state.latitude || 0,
      longitude: state.longitude || 0,
      altitude: state.geo_altitude || 0,
      velocity: state.velocity || 0,
    }));

    // Cache the data
    unifiedCache.setLiveData(key, positions);

    res.status(200).json({ positions });
  } catch (error: any) {
    console.error('[API] Failed to load live data:', error.message);
    res.status(500).json({ error: 'Failed to load live data.' });
  }
}