import { allQuery } from '../../db/databaseManager';

export async function initializeAircraftCache() {
  console.log('[Init] Static data initialization skipped; no cache setup needed for static data.');
  // Optionally verify static data in the database
  const manufacturers = await allQuery('SELECT DISTINCT manufacturer FROM aircraft_data', []);
  console.log(`[Init] Found ${manufacturers.length} manufacturers in the database.`);
}
