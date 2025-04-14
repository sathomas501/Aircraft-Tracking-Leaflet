// pages/api/aircraft/tracking/manufacturers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { SelectOption } from '@/types/base';
import dbManager from '../../../lib/db/DatabaseManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[API] Manufacturers endpoint called with method:', req.method);

  try {
    // Check database connection first
    console.log('[API] Checking database connection...');
    await dbManager.initialize();
    console.log('[API] Database initialized successfully');

    // Get top 75 manufacturers by aircraft count
    console.log('[API] Fetching manufacturers...');

    // Use a simpler query with explicit column name targeting
    const query = `
      SELECT 
        MANUFACTURER AS name, 
        COUNT(*) AS count 
      FROM aircraft 
      WHERE MANUFACTURER IS NOT NULL 
      GROUP BY MANUFACTURER 
      HAVING count > 0 
      ORDER BY count DESC 
      LIMIT 75
    `;

    console.log('[API] Executing query:', query);

    // 1. First check for empty table
    const countQuery = await dbManager.query(
      'aircraft-count',
      'SELECT COUNT(*) as count FROM aircraft',
      [],
      0
    );
    const tableCount =
      countQuery.length > 0 ? (countQuery[0] as any).count || 0 : 0;

    console.log('[API] Aircraft table has', tableCount, 'records');

    if (tableCount === 0) {
      console.log('[API] Aircraft table is empty, returning empty result');
      return res.status(200).json([]);
    }

    // 2. Execute the manufacturers query
    const manufacturers = await dbManager.query(
      'manufacturers-direct',
      query,
      [],
      0
    );
    console.log('[API] Query returned', manufacturers.length, 'results');

    // Log a sample of the results
    if (manufacturers.length > 0) {
      console.log('[API] Sample results:', manufacturers.slice(0, 3));
    }

    // Format for the UI
    const formattedManufacturers: SelectOption[] = manufacturers.map(
      (m: any) => ({
        value: m.name as string,
        label: `${m.name as string} (${m.count as number} aircraft)`,
      })
    );

    return res.status(200).json(formattedManufacturers);
  } catch (error) {
    console.error('[API] Error fetching manufacturers:', error);

    // Check database tables
    try {
      console.log('[API] Checking database tables...');
      const tables = await dbManager.query(
        'db-tables',
        "SELECT name FROM sqlite_master WHERE type='table'",
        [],
        0
      );
      console.log('[API] Database tables:', tables);

      // If aircraft table exists, check schema
      if (tables.some((t: any) => t.name === 'aircraft')) {
        const schemaResult = await dbManager.query(
          'aircraft-schema',
          'PRAGMA table_info(aircraft)',
          [],
          0
        );
        console.log('[API] Aircraft table schema:', schemaResult);
      }
    } catch (tableError) {
      console.error('[API] Error checking tables:', tableError);
    }

    return res.status(500).json({
      error: 'Failed to fetch manufacturers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
