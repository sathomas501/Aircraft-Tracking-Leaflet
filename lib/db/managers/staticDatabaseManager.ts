// lib/db/managers/staticDatabaseManager.ts
import path from 'path';
import { BaseDatabaseManager } from '../managers/baseDatabaseManager';
import CacheManager from '@/lib/services/managers/cache-manager';
import { aircraftCache } from '@/lib/services/managers/aircraft-cache';
import { AircraftRecord, Aircraft } from '../../../types/base';
import trackingDatabaseManager from './trackingDatabaseManager'; // ✅ Import TrackingDB

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

interface ActiveModel {
  model: string;
  manufacturer: string;
  count: number;
  activeCount: number;
  totalCount: number;
}

interface DatabaseConfig {
  trackingDbPath: string;
}

class StaticDatabaseManager extends BaseDatabaseManager {
  private static instance: StaticDatabaseManager | null = null;
  private config: DatabaseConfig = {
    trackingDbPath: process.env.TRACKING_DB_PATH || './tracking.db',
  };

  private readonly manufacturerListCache = new CacheManager<ManufacturerInfo[]>(
    5 * 60
  );
  private readonly manufacturerValidationCache = new CacheManager<Set<string>>(
    60 * 60
  ); // 1 hour cache
  private readonly MANUFACTURER_LIST_CACHE_KEY = 'manufacturers-with-count';
  private readonly MANUFACTURER_VALIDATION_CACHE_KEY = 'valid-manufacturers';
  private readonly icao24Cache = new CacheManager<string[]>(5 * 60);
  private readonly aircraftCache = new CacheManager<AircraftRecord[]>(5 * 60);
  private readonly ICAO24_CACHE_PREFIX = 'aircraft_icao24_';

  private constructor() {
    super('static.db');
  }

  public setConfig(config: Partial<DatabaseConfig>) {
    this.config = { ...this.config, ...config };
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
        "N-NUMBER" TEXT,
        NAME TEXT,
        CITY TEXT,
        STATE TEXT,
        TYPE_AIRCRAFT TEXT,
        OWNER_TYPE TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft(icao24);
      CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer ON aircraft(manufacturer);
      CREATE INDEX IF NOT EXISTS idx_aircraft_n_number ON aircraft("N-NUMBER");
    `);

    console.log('[StaticDB] Tables and indices created');
  }

  private async getValidManufacturers(): Promise<Set<string>> {
    const cached = await this.manufacturerValidationCache.get(
      this.MANUFACTURER_VALIDATION_CACHE_KEY
    );
    if (cached) {
      console.log('[StaticDB] Using cached manufacturer validation list');
      return cached;
    }

    console.log(
      '[StaticDB] Fetching manufacturer validation list from database'
    );
    const query = `
      SELECT DISTINCT manufacturer 
      FROM aircraft 
      WHERE manufacturer IS NOT NULL 
      AND manufacturer != ''
    `;

    const results = await this.executeQuery<{ manufacturer: string }>(query);
    const manufacturers = new Set(
      results.map((r) => r.manufacturer.trim().toUpperCase())
    );

    await this.manufacturerValidationCache.set(
      this.MANUFACTURER_VALIDATION_CACHE_KEY,
      manufacturers
    );
    console.log(
      `[StaticDB] Cached ${manufacturers.size} manufacturers for validation`
    );

    return manufacturers;
  }

  public async validateManufacturer(manufacturer: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const validManufacturers = await this.getValidManufacturers();
      return validManufacturers.has(manufacturer.trim().toUpperCase());
    } catch (error) {
      console.error('[StaticDB] Failed to validate manufacturer:', error);
      const query = `
        SELECT COUNT(*) as count
        FROM aircraft
        WHERE UPPER(manufacturer) = UPPER(?)
      `;
      const result = await this.executeQuery<{ count: number }>(query, [
        manufacturer,
      ]);
      return (result[0]?.count || 0) > 0;
    }
  }

  public async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    await this.ensureInitialized();

    const cacheKey = `icao24s-${manufacturer.toUpperCase()}`;
    const cached = await this.icao24Cache.get(cacheKey);

    if (cached?.length) {
      console.log(`[StaticDB] ✅ Using cached ICAO24s for ${manufacturer}`);
      return cached;
    }

    console.log(`[StaticDB] 🔍 Fetching ICAO24s from DB for ${manufacturer}`);
    const query = `
      SELECT DISTINCT icao24
      FROM aircraft
      WHERE manufacturer = ?
      AND icao24 IS NOT NULL AND icao24 != ''
      AND LENGTH(icao24) = 6
      AND LOWER(icao24) GLOB '[0-9a-f]*'
      ORDER BY icao24
    `;

    try {
      const results = await this.executeQuery<{ icao24: string }>(query, [
        manufacturer,
      ]);
      const icao24List = results.map((r) => r.icao24.toLowerCase());

      if (icao24List.length) {
        await this.icao24Cache.set(cacheKey, icao24List);
        console.log(`[StaticDB] ✅ Cached ${icao24List.length} ICAO24s`);
      } else {
        console.warn(`[StaticDB] ⚠️ No ICAOs found for ${manufacturer}`);
      }

      return icao24List;
    } catch (error) {
      console.error(`[StaticDB] ❌ Error fetching ICAO24s: ${error}`);
      return [];
    }
  }

  public async getDatabaseState(): Promise<DatabaseState> {
    try {
      const tables = !this.db
        ? []
        : await this.executeQuery<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          ).then((results) => results.map((r) => r.name));

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

  private async getBasicModelStats(
    manufacturer: string
  ): Promise<ActiveModel[]> {
    const query = `
      SELECT 
        model,
        manufacturer,
        COUNT(DISTINCT icao24) as total_count
      FROM aircraft
      WHERE manufacturer = ?
      GROUP BY model, manufacturer
      ORDER BY total_count DESC;
    `;

    const results = await this.executeQuery<{
      model: string;
      manufacturer: string;
      total_count: number;
    }>(query, [manufacturer]);

    return results.map((result) => ({
      model: result.model,
      manufacturer: result.manufacturer,
      label: `${result.model} (0 active)`,
      totalCount: result.total_count,
      count: result.total_count,
      activeCount: 0,
    }));
  }

  public async getModelsByManufacturer(
    manufacturer: string
  ): Promise<ActiveModel[]> {
    await this.ensureInitialized();

    console.log(`[StaticDB] 📊 Fetching models for ${manufacturer}`);

    const query = `
      SELECT model, COUNT(DISTINCT icao24) as total_count
      FROM aircraft
      WHERE manufacturer = ?
      GROUP BY model
      ORDER BY total_count DESC;
    `;

    let modelResults: { model: string; total_count: number }[] = [];

    try {
      modelResults = await this.executeQuery<{
        model: string;
        total_count: number;
      }>(query, [manufacturer]);

      if (modelResults.length === 0) {
        console.log(`[StaticDB] ❌ No models found for ${manufacturer}`);
        return [];
      }

      console.log(`[StaticDB] ✅ Found ${modelResults.length} models`);

      // Fetch active aircraft count **only if models exist**
      const activeAircraftMap = new Map<string, boolean>();
      try {
        const trackedAircraft =
          await trackingDatabaseManager.getTrackedAircraft(manufacturer);
        trackedAircraft.forEach((aircraft) => {
          if (aircraft.icao24)
            activeAircraftMap.set(aircraft.icao24.toLowerCase(), true);
        });
      } catch (trackingError) {
        console.warn(
          `[StaticDB] ⚠️ Could not fetch tracking data: ${trackingError}`
        );
      }

      // Map models with active counts
      return modelResults.map(({ model, total_count }) => ({
        model,
        manufacturer,
        label: `${model} (${activeAircraftMap.size} active)`,
        totalCount: total_count,
        count: total_count,
        activeCount: activeAircraftMap.size,
      }));
    } catch (error) {
      console.error(`[StaticDB] ❌ Error fetching models: ${error}`);
      throw error;
    }
  }

  public async getAircraftByIcao24s(
    icao24s: string[]
  ): Promise<AircraftRecord[]> {
    await this.ensureInitialized();

    if (!Array.isArray(icao24s) || icao24s.length === 0) {
      throw new Error('Invalid ICAO24 list');
    }

    console.log(
      `[StaticDB] 🔍 Fetching aircraft for ${icao24s.length} ICAO24s`
    );

    const cacheKeys = icao24s.map(
      (icao) => `${this.ICAO24_CACHE_PREFIX}${icao}`
    );
    const cachedResults = await this.aircraftCache.getMultiple(cacheKeys);

    const cachedAircraft = Object.values(cachedResults).flat();
    const missingIcao24s = icao24s.filter(
      (icao) => !cachedResults[`${this.ICAO24_CACHE_PREFIX}${icao}`]
    );

    if (missingIcao24s.length === 0) {
      console.log(`[StaticDB] ✅ Returning cached aircraft data`);
      return cachedAircraft;
    }

    console.log(
      `[StaticDB] 🔍 Fetching missing ${missingIcao24s.length} aircraft from DB`
    );

    const placeholders = missingIcao24s.map(() => '?').join(',');
    const query = `
      SELECT icao24, "N-NUMBER", manufacturer, model, NAME, CITY, STATE, TYPE_AIRCRAFT, OWNER_TYPE
      FROM aircraft
      WHERE icao24 IN (${placeholders})
    `;

    try {
      const fetchedAircraft = await this.executeQuery<AircraftRecord>(
        query,
        missingIcao24s
      );

      // Cache the fetched aircraft
      if (fetchedAircraft.length > 0) {
        const cacheEntries: Record<string, AircraftRecord[]> = {};
        fetchedAircraft.forEach((aircraft) => {
          cacheEntries[`${this.ICAO24_CACHE_PREFIX}${aircraft.icao24}`] = [
            aircraft,
          ];
        });
        await this.aircraftCache.setMultiple(cacheEntries);
      }

      console.log(
        `[StaticDB] ✅ Fetched ${fetchedAircraft.length} aircraft from DB`
      );
      return [...cachedAircraft, ...fetchedAircraft];
    } catch (error) {
      console.error(`[StaticDB] ❌ Error fetching aircraft data: ${error}`);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Unknown error fetching aircraft data'
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

  public async invalidateCaches(): Promise<void> {
    await Promise.all([
      this.manufacturerListCache.delete(this.MANUFACTURER_LIST_CACHE_KEY),
      this.manufacturerValidationCache.delete(
        this.MANUFACTURER_VALIDATION_CACHE_KEY
      ),
      this.icao24Cache.delete('*'),
      this.aircraftCache.delete('*'),
    ]);
    console.log('[StaticDB] All caches invalidated');
  }
}

const staticDatabaseManager = StaticDatabaseManager.getInstance();
export { StaticDatabaseManager };
export default staticDatabaseManager;
