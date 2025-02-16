import databaseManager from '../../db/databaseManager';

interface ManufacturerRow {
  manufacturer: string;
}

export async function initializeAircraftCache() {
  console.log(
    '[Init] Static data initialization skipped; no cache setup needed for static data.'
  );
  // Optionally verify static data in the database
  const manufacturers = await databaseManager.executeQuery<ManufacturerRow>(
    'SELECT DISTINCT manufacturer FROM aircraft_data',
    []
  );

  console.log(
    `[Init] Found ${manufacturers.length} manufacturers in the database.`
  );
}
