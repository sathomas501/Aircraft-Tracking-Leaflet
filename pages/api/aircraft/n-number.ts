// pages/api/aircraft/n-number.ts

import { NextApiRequest, NextApiResponse } from 'next';
import staticDatabaseManager from '@/lib/db/managers/staticDatabaseManager';
import { AircraftRecord } from '../../../types/base';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { nNumber } = req.body;

    if (!nNumber) {
      return res.status(400).json({ error: 'N-Number is required' });
    }

    console.log(`[N-Number API] Searching for aircraft: ${nNumber}`);

    // ✅ Await the instance before using it
    const db = await staticDatabaseManager;

    // ✅ Call the method on the resolved instance
    const aircraft = await db.getAircraftByNNumber(nNumber);

    if (!aircraft) {
      return res.status(404).json({ error: 'Aircraft not found' });
    }

    return res.status(200).json({ positions: [aircraft] });
  } catch (error) {
    console.error('[N-Number API] ❌ Error processing request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
