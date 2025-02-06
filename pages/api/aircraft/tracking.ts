// pages/api/aircraft/tracking.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/trackingDatabaseManager';
import { DatabaseManager } from '@/lib/db/databaseManager';
import { handleApiError } from '@/lib/services/error-handler';
import { Aircraft, TrackingData, IManufacturer } from '@/types/base';

interface UpdatePositionsResponse {
  success: boolean;
  message: string;
  updatedCount?: number;
}

interface StaticDataResponse {
  success: boolean;
  data: Aircraft[];
}

interface ManufacturerResponse {
  success: boolean;
  data: IManufacturer[];
  message?: string;
}

// API Handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    UpdatePositionsResponse | StaticDataResponse | ManufacturerResponse
  >
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
    const trackingDb = TrackingDatabaseManager.getInstance();
    await trackingDb.initialize();

    const { action } = req.body;

    switch (action) {
      case 'updatePositions': {
        const { positions } = req.body;
        if (!Array.isArray(positions)) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid positions data' });
        }
        const updatedCount = await updatePositions(trackingDb, positions);
        return res.status(200).json({
          success: true,
          message: `Updated ${updatedCount} aircraft positions`,
          updatedCount,
        });
      }

      case 'upsertActiveAircraftBatch': {
        const { trackingData } = req.body;
        if (!Array.isArray(trackingData)) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid trackingData' });
        }
        await upsertActiveAircraftBatch(trackingDb, trackingData);
        return res
          .status(200)
          .json({ success: true, message: 'Aircraft batch updated' });
      }

      default:
        return res
          .status(400)
          .json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    return handleApiError(res, error);
  }
}

export async function upsertActiveAircraftBatch(
  trackingDb: TrackingDatabaseManager, // ✅ Pass trackingDb explicitly
  trackingData: TrackingData[]
) {
  try {
    // ✅ Call the correct method from `trackingDb`
    await upsertActiveAircraftBatch(trackingDb, trackingData);

    console.log(
      `[Tracking] Upserted ${trackingData.length} active aircraft records.`
    );
  } catch (error) {
    console.error('[Tracking] Error upserting active aircraft batch:', error);
    throw error;
  }
}

export async function getTrackedAircraft(
  trackingDb: TrackingDatabaseManager // ✅ Pass trackingDb explicitly
) {
  try {
    return await trackingDb.getTrackedAircraft();
  } catch (error) {
    console.error('Error fetching tracked aircraft:', error);
    throw error;
  }
}

export async function trackAircraft(
  trackingDb: TrackingDatabaseManager, // ✅ Pass trackingDb explicitly
  aircraftData: any
) {
  try {
    return await trackingDb.trackAircraft(aircraftData);
  } catch (error) {
    console.error('Error tracking aircraft:', error);
    throw error;
  }
}

export async function updateAircraftPosition(
  trackingDb: TrackingDatabaseManager, // ✅ Pass trackingDb explicitly
  icao24: string,
  positionData: any
) {
  try {
    const { lat, lon, heading } = positionData;
    return await trackingDb.updateAircraftPosition(icao24, lat, lon, heading);
  } catch (error) {
    console.error(`Error updating position for ${icao24}:`, error);
    throw error;
  }
}

export async function clearTrackingData(
  trackingDb: TrackingDatabaseManager // ✅ Pass trackingDb explicitly
) {
  try {
    return await trackingDb.clearTrackingData();
  } catch (error) {
    console.error('Error clearing tracking data:', error);
    throw error;
  }
}

async function updatePositions(
  trackingDb: TrackingDatabaseManager, // ✅ Pass trackingDb explicitly
  positions: TrackingData[]
): Promise<number> {
  await trackingDb.initialize();
  const db = trackingDb.getDb();

  if (!db) {
    throw new Error('Database connection is null');
  }

  try {
    await db.run('BEGIN TRANSACTION');
    let updatedCount = 0;

    for (const position of positions) {
      const result = (await db.run(
        `INSERT INTO active_tracking (
            icao24, last_contact, latitude, longitude,
            altitude, velocity, heading, on_ground, last_seen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(icao24) DO UPDATE SET
            last_contact = excluded.last_contact,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            altitude = excluded.altitude,
            velocity = excluded.velocity,
            heading = excluded.heading,
            on_ground = excluded.on_ground,
            last_seen = CURRENT_TIMESTAMP;
        `,
        [
          position.icao24,
          position.last_contact,
          position.latitude,
          position.longitude,
          position.altitude,
          position.velocity,
          position.heading,
          position.on_ground ? 1 : 0,
        ]
      )) as unknown as { changes: number };

      if (result && result.changes > 0) {
        updatedCount++;
      }
    }

    await db.run('COMMIT');
    return updatedCount;
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  } finally {
    await trackingDb.stop();
  }
}

async function getStaticData(
  mainDb: DatabaseManager, // ✅ Pass mainDb explicitly
  icao24s: string[]
): Promise<Aircraft[]> {
  await mainDb.initializeDatabase();

  const query = `
        SELECT 
            icao24, "N-NUMBER", manufacturer, model, operator,
            NAME, CITY, STATE, TYPE_AIRCRAFT, OWNER_TYPE
        FROM aircraft
        WHERE icao24 IN (${icao24s.map(() => '?').join(',')})
    `;

  const results = await mainDb.executeQuery<Partial<Aircraft>>(query, icao24s);

  return results.map((result) => ({
    icao24: result.icao24 || '',
    'N-NUMBER': result['N-NUMBER'] || '',
    manufacturer: result.manufacturer || 'Unknown',
    model: result.model || 'Unknown',
    operator: result.operator || 'Unknown',
    latitude: 0,
    longitude: 0,
    altitude: 0,
    heading: 0,
    velocity: 0,
    on_ground: false,
    last_contact: 0,
    NAME: result.NAME || '',
    CITY: result.CITY || '',
    STATE: result.STATE || '',
    OWNER_TYPE: result.OWNER_TYPE || 'Unknown',
    TYPE_AIRCRAFT: result.TYPE_AIRCRAFT || 'Unknown',
    isTracked: true,
  }));
}

async function getManufacturerData(
  mainDb: DatabaseManager, // ✅ Pass mainDb explicitly
  manufacturer: string,
  model?: string
): Promise<IManufacturer[]> {
  await mainDb.initializeDatabase();

  const query = `
        SELECT DISTINCT
            manufacturer as value,
            manufacturer as label,
            COUNT(icao24) as count
        FROM aircraft
        WHERE manufacturer = ?
        ${model ? 'AND model = ?' : ''}
        AND icao24 IS NOT NULL AND icao24 != ''
        GROUP BY manufacturer
        ORDER BY count DESC
        LIMIT 2000;
    `;

  const params = model ? [manufacturer, model] : [manufacturer];
  const results = await mainDb.executeQuery<{
    value: string;
    label: string;
    count: number;
  }>(query, params);

  return results.map((r) => ({
    value: r.value,
    label: r.label,
    activeCount: 0,
  }));
}
