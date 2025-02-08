import { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '../../../lib/db/databaseManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { method, query } = req;

    if (method !== 'GET') {
      return res
        .status(405)
        .json({ success: false, message: 'Method not allowed' });
    }

    const manufacturer = query.manufacturer as string;
    if (!manufacturer) {
      return res.status(400).json({
        success: false,
        message: 'Manufacturer query parameter is required.',
      });
    }

    console.log(`[API] Fetching models for manufacturer: ${manufacturer}`);

    await databaseManager.initializeDatabase(); // ✅ Ensure DB is initialized

    const sqlQuery = `
      SELECT DISTINCT model 
      FROM aircraft 
      WHERE manufacturer = ? 
      ORDER BY model
    `;

    try {
      console.time(`[API] Model Query Execution`); // ✅ Measure query time
      const models: { model: string }[] = await databaseManager.executeQuery(
        sqlQuery,
        [manufacturer]
      );
      console.timeEnd(`[API] Model Query Execution`);

      if (!models.length) {
        console.warn(`[API] No models found for manufacturer: ${manufacturer}`);
      }

      return res.status(200).json({
        success: true,
        message: `Found ${models.length} models for ${manufacturer}`,
        data: models.map((m) => m.model), // ✅ Return array of model names
      });
    } catch (error) {
      console.error(`[API] Database error:`, error);
      return res
        .status(500)
        .json({ success: false, message: 'Database query failed.' });
    }
  } catch (error) {
    console.error('[API] Internal Server Error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
}
