// pages/api/clientpositions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Aircraft } from '@/types/base';
import { getDatabase } from '@/lib/db/databaseManager';

interface PositionsResponse {
  aircraft?: Aircraft[];
  error?: string;
  message?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { icao24s } = req.body;

  if (!icao24s || !Array.isArray(icao24s) || icao24s.length === 0) {
      console.warn('Invalid payload received:', req.body);
      return res.status(400).json({ error: 'icao24s array is required' });
  }
   {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `HTTP method ${req.method} is not supported.`,
    });
  }

  const { icao24s } = req.body;


  if (!icao24s || !Array.isArray(icao24s) || icao24s.length === 0) {
    console.error('Invalid payload received:', req.body); // Log the invalid payload
    return res.status(400).json({ error: 'icao24s array is required' });
  }

  try {
    const db = await getDatabase();
    if (!db) {
      throw new Error('No active database connection');
    }

    const placeholders = icao24s.map(() => '?').join(',');
    const query = `
      SELECT icao24, manufacturer, model
      FROM aircraft
      WHERE icao24 IN (${placeholders})
      AND icao24 IS NOT NULL;
    `;

    const aircraft = await db.all<Aircraft[]>(query, icao24s);
    res.status(200).json({ aircraft });
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    const statusCode =
      (error as Error).message === 'No active database connection' ? 503 : 500;
    res.status(statusCode).json({
      error: statusCode === 503 ? 'Database unavailable' : 'Failed to fetch aircraft',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
}}
