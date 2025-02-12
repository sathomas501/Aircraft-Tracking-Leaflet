import type { NextApiRequest, NextApiResponse } from 'next';
import trackingDatabaseManager from '@/lib/db/trackingDatabaseManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('[Database API] 🔍 Validating database schema...');
    await trackingDatabaseManager.validateSchema();
    return res
      .status(200)
      .json({
        success: true,
        message: 'Database validation completed successfully.',
      });
  } catch (error) {
    console.error('[Database API] ❌ Error validating database:', error);
    return res
      .status(500)
      .json({ error: 'Database validation failed', details: error });
  }
}
