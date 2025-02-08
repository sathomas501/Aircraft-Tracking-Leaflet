import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const { nNumber } = req.query;
  if (!nNumber || typeof nNumber !== 'string') {
    return res
      .status(400)
      .json({ success: false, message: 'N-Number parameter is required' });
  }

  console.log(`🔍 Searching for aircraft with N-Number: ${nNumber}`);

  await databaseManager.initializeDatabase();

  try {
    const results = await databaseManager.executeQuery(
      `SELECT * FROM aircraft WHERE "N-NUMBER" = ? LIMIT 1`,
      [nNumber]
    );

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('❌ Database error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
}
