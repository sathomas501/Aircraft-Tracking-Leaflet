import { NextApiRequest, NextApiResponse } from 'next';
import { OpenSkySyncService } from '@/lib/services/openSkySyncService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { aircraft } = req.body;
    const openSkySyncService = OpenSkySyncService.getInstance();
    await openSkySyncService.startSync(aircraft);
    res.status(200).json({ message: 'Tracking started successfully' });
  } catch (error) {
    console.error('[API] Error starting sync:', error);
    res.status(500).json({ error: 'Failed to start tracking' });
  }
}
