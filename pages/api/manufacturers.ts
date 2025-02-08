//pages/api/manufactures.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import type { SelectOption } from '@/types/base';

interface ManufacturersResponse {
  manufacturers: SelectOption[];
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ManufacturersResponse>
) {
  const db = DatabaseManager.getInstance();
  await db.initializeDatabase();

  if (req.method === 'GET') {
    try {
      console.log('[Manufacturers] Fetching manufacturers from DB...');
      const result = await db.allQuery<{ name: string; count: number }>(
        `SELECT 
          manufacturer AS name, 
          COUNT(*) AS count 
        FROM aircraft 
        WHERE manufacturer IS NOT NULL 
        GROUP BY manufacturer 
        ORDER BY count DESC 
        LIMIT 50`
      );

      const manufacturers: SelectOption[] = result.map((m) => ({
        value: m.name,
        label: m.name,
        count: m.count,
      }));

      console.log(
        `[Manufacturers] Found ${manufacturers.length} manufacturers`
      );
      return res.status(200).json({ manufacturers });
    } catch (error) {
      console.error('[Manufacturers] Database error:', error);
      return res
        .status(500)
        .json({ manufacturers: [], error: 'Failed to fetch manufacturers' });
    }
  }

  return res
    .status(405)
    .json({ manufacturers: [], error: 'Method not allowed' });
}
