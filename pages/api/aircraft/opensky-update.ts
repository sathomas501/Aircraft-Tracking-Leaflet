// pages/api/aircraft/opensky-update.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenSkyService } from '@/lib/services/openSkyService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    const { states } = req.body;

    if (!Array.isArray(states)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'States must be an array'
      });
    }

    await OpenSkyService.updateActiveAircraft(states);

    return res.status(200).json({
      success: true,
      message: `Updated ${states.length} aircraft states`
    });
  } catch (error) {
    console.error('Error updating OpenSky data:', error);
    return res.status(500).json({
      error: 'Failed to update aircraft states',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    });
  }
}