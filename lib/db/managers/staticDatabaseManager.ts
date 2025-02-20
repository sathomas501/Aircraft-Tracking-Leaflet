// lib/db/managers/staticDatabaseManager.ts
import { BaseDatabaseManager } from '../managers/baseDatabaseManager';
import CacheManager from '@/lib/services/managers/cache-manager';
import { AircraftRecord } from '../../../types/base';

// Define interfaces at the top
interface ManufacturerInfo {
  name: string;
  count: number;
}

interface DatabaseState {
  isReady: boolean;
  tables: string[];
  cacheStatus: {
    manufacturersAge: number | null;
    icaosAge: number | null;
  };
}

// lib/db/managers/staticDatabaseManager.ts
interface StaticModel {
  model: string;
  manufacturer: string;
  count: number;
}

class StaticDatabaseManager extends BaseDatabaseManager {
  private static instance: StaticDatabaseManager | null = null;

  private readonly manufacturerListCache = new CacheManager<ManufacturerInfo[]>(
    5 * 60
  );
  private readonly MANUFACTURER_LIST_CACHE_KEY = 'manufacturers-with-count';
  private readonly icao24Cache = new CacheManager<string[]>(5 * 60);
  private readonly aircraftCache = new CacheManager<AircraftRecord[]>(5 * 60); // 5-minute cache
  private readonly ICAO24_CACHE_PREFIX = 'aircraft_icao24_';

  private constructor() {
    super('static.db');
  }

  public static getInstance(): StaticDatabaseManager {
    if (!StaticDatabaseManager.instance) {
      StaticDatabaseManager.instance = new StaticDatabaseManager();
    }
    return StaticDatabaseManager.instance;
  }

  protected async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS aircraft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao24 TEXT UNIQUE,
        registration TEXT,
        manufacturer TEXT,
        model TEXT,
        owner TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft(icao24);
      CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer ON aircraft(manufacturer);
    `);

    console.log('[StaticDB] Tables and indices created');
  }

  public async getDatabaseState(): Promise<DatabaseState> {
    try {
      // Get table information
      const tables = !this.db
        ? []
        : await this.executeQuery<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          ).then((results) => results.map((r) => r.name));

      // Cache status - null if not cached, timestamp if cached
      const manufacturersAge = (await this.manufacturerListCache.get(
        this.MANUFACTURER_LIST_CACHE_KEY
      ))
        ? Date.now()
        : null;

      const icaosAge = (await this.icao24Cache.get('*')) ? Date.now() : null;

      return {
        isReady: this.isReady,
        tables,
        cacheStatus: {
          manufacturersAge,
          icaosAge,
        },
      };
    } catch (error) {
      console.error('[StaticDB] Failed to get database state:', error);
      return {
        isReady: false,
        tables: [],
        cacheStatus: {
          manufacturersAge: null,
          icaosAge: null,
        },
      };
    }
  }

  public async getManufacturersWithCount(
    limit: number = 50
  ): Promise<ManufacturerInfo[]> {
    await this.ensureInitialized();

    // Try to get from cache first
    const cached = await this.manufacturerListCache.get(
      this.MANUFACTURER_LIST_CACHE_KEY
    );
    if (cached) {
      console.log('[StaticDB] Using cached manufacturers list');
      return cached.slice(0, limit);
    }

    console.log('[StaticDB] Fetching manufacturers from database');

    try {
      const result = await this.executeQuery<ManufacturerInfo>(
        `SELECT name, count FROM (
          SELECT
            TRIM(manufacturer) AS name,
            COUNT(*) AS count
          FROM aircraft
          WHERE manufacturer IS NOT NULL
          AND TRIM(manufacturer) != ''
          GROUP BY TRIM(manufacturer)
          HAVING count > 0
          ORDER BY count DESC
          LIMIT ?
        ) AS TopManufacturers
        ORDER BY name ASC`,
        [limit]
      );

      const manufacturers = result.filter((m) => m.name && m.count);

      // Cache the results
      await this.manufacturerListCache.set(
        this.MANUFACTURER_LIST_CACHE_KEY,
        manufacturers
      );
      console.log(`[StaticDB] Cached ${manufacturers.length} manufacturers`);

      return manufacturers;
    } catch (error) {
      console.error('[StaticDB] Failed to fetch manufacturers:', error);
      throw new Error(
        error instanceof Error
          ? `Failed to fetch manufacturers: ${error.message}`
          : 'Failed to fetch manufacturers'
      );
    }
  }

  public async getModelsByManufacturer(
    manufacturer: string
  ): Promise<StaticModel[]> {
    await this.ensureInitialized();

    if (!manufacturer) {
      throw new Error('Manufacturer parameter is required');
    }

    console.log(`[StaticDB] Fetching models for manufacturer: ${manufacturer}`);

    const query = `
    SELECT model, manufacturer, COUNT(*) as count
    FROM aircraft
    WHERE manufacturer = ?
      AND model IS NOT NULL 
      AND model != ''
    GROUP BY model, manufacturer
    ORDER BY count DESC, model ASC;
  `;

    try {
      const results = await this.executeQuery<StaticModel>(query, [
        manufacturer,
      ]);
      return Array.isArray(results) ? results : [results];
    } catch (error) {
      console.error(`[StaticDB] ❌ Error fetching models: ${error}`);
      throw new Error(
        error instanceof Error ? error.message : 'Unknown error fetching models'
      );
    }
  }

  public async getAircraftByNNumber(
    nNumber: string
  ): Promise<AircraftRecord | null> {
    await this.ensureInitialized();

    if (!nNumber) {
      throw new Error('N-Number parameter is required');
    }

    console.log(`[StaticDB] Fetching aircraft with N-Number: ${nNumber}`);

    const query = `
    SELECT * FROM aircraft WHERE n_number = ? LIMIT 1;
  `;

    try {
      const results = await this.executeQuery<AircraftRecord>(query, [
        nNumber.trim(),
      ]);
      return results.length ? results[0] : null;
    } catch (error) {
      console.error(
        `[StaticDB] ❌ Error fetching aircraft by N-Number: ${error}`
      );
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Unknown error fetching aircraft'
      );
    }
  }

  /**
   * Fetch aircraft details for a list of ICAO24 codes, using cache when possible.
   */
  public async getAircraftByIcao24s(
    icao24s: string[]
  ): Promise<AircraftRecord[]> {
    await this.ensureInitialized();

    if (!Array.isArray(icao24s) || icao24s.length === 0) {
      throw new Error('Invalid ICAO24 list');
    }

    console.log(`[StaticDB] Fetching data for ${icao24s.length} aircraft`);

    // Check cache for existing aircraft data
    const cachedResults: Record<string, AircraftRecord[]> =
      this.aircraftCache.getMultiple(
        icao24s.map((code) => `${this.ICAO24_CACHE_PREFIX}${code}`)
      );

    const cachedAircraft = Object.values(cachedResults).flat();
    const missingIcao24s = icao24s.filter(
      (code) => !cachedResults[`${this.ICAO24_CACHE_PREFIX}${code}`]
    );

    // If all aircraft are found in cache, return early
    if (missingIcao24s.length === 0) {
      console.log(`[StaticDB] ✅ Returning cached aircraft data`);
      return cachedAircraft;
    }

    // Query the database for missing ICAO24 codes
    const placeholders = missingIcao24s.map(() => '?').join(',');
    const query = `
      SELECT 
        icao24,
        "N-NUMBER",
        manufacturer,
        model,
        NAME,
        CITY,
        STATE,
        TYPE_AIRCRAFT,
        OWNER_TYPE
      FROM aircraft
      WHERE icao24 IN (${placeholders})
    `;

    let fetchedAircraft: AircraftRecord[] = [];

    try {
      fetchedAircraft = await this.executeQuery<AircraftRecord>(
        query,
        missingIcao24s
      );
      console.log(
        `[StaticDB] ✅ Found ${fetchedAircraft.length} aircraft in DB`
      );

      // Store fetched data in cache
      const cacheEntries: Record<string, AircraftRecord[]> = {};
      fetchedAircraft.forEach((aircraft) => {
        cacheEntries[`${this.ICAO24_CACHE_PREFIX}${aircraft.icao24}`] = [
          aircraft,
        ];
      });
      this.aircraftCache.setMultiple(cacheEntries);
    } catch (error) {
      console.error(`[StaticDB] ❌ Error fetching aircraft data: ${error}`);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Unknown error fetching aircraft data'
      );
    }

    // Return combined results from cache and database
    return [...cachedAircraft, ...fetchedAircraft];
  }

  // Method to invalidate caches
  public async invalidateCaches(): Promise<void> {
    await Promise.all([
      this.manufacturerListCache.delete(this.MANUFACTURER_LIST_CACHE_KEY),
      this.icao24Cache.delete('*'),
    ]);
    console.log('[StaticDB] All caches invalidated');
  }
}

const staticDatabaseManager = StaticDatabaseManager.getInstance();
export { StaticDatabaseManager };
export default staticDatabaseManager;
