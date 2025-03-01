import type { NextApiRequest, NextApiResponse } from 'next';
import staticDatabaseManager from '@/lib/db/managers/staticDatabaseManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const { manufacturer } = req.body;
  let updatedCount = 0;

  try {
    if (!manufacturer) {
      return res
        .status(400)
        .json({ success: false, message: 'Manufacturer is required' });
    }

    console.log(
      `[UpdateModels] Fetching models from static DB for: ${manufacturer}`
    );

    // ✅ Fetch model data from static DB only
    const staticModels =
      await staticDatabaseManager.getModelsByManufacturer(manufacturer);

    if (!staticModels.length) {
      console.log(`[UpdateModels] No static models found for ${manufacturer}`);
      return res.status(200).json({
        success: true,
        message: `No static models found for ${manufacturer}`,
        updated: 0,
      });
    }

    console.log(
      `[UpdateModels] Found ${staticModels.length} static models for ${manufacturer}`
    );

    // ✅ Create a lookup map for faster access
    const modelMap = new Map(
      staticModels.map((m) => [m.model.toLowerCase(), m.model])
    );

    return res.status(200).json({
      success: true,
      updated: updatedCount,
      message: `Updated ${updatedCount} aircraft models for ${manufacturer}`,
    });
  } catch (error) {
    console.error('[UpdateModels] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update models',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
