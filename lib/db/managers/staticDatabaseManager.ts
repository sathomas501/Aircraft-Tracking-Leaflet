// lib/db/managers/staticDatabaseManager.ts
import path from 'path';
import { BaseDatabaseManager } from './baseDatabaseManager';
import { CacheManager } from '@/lib/services/managers/cache-manager';
import { AircraftRecord, Aircraft } from '../../../types/base';

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
  city?: string;
  state?: string;
  ownerType?: string;
  name?: string;
}

interface DatabaseConfig {
  trackingDbPath: string;
}

class StaticDatabaseManager extends BaseDatabaseManager {
  private static instance: StaticDatabaseManager | null = null;
  // Use a different property name to avoid conflict with BaseDatabaseManager
  private static initializationPromise: Promise<void> | null = null; // Track initialization state

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

  // In staticDatabaseManager.ts, modify the constructor
  private constructor() {
    // If you have a fixed path, use that directly
    if (process.env.STATIC_DB_PATH) {
      super(process.env.STATIC_DB_PATH);
    } else {
      // Otherwise, use the default path but log a warning
      super('static.db');
      console.warn(
        '[StaticDB] ⚠️ No STATIC_DB_PATH environment variable found, using default path'
      );
    }
  }

  public setConfig(config: Partial<DatabaseConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the singleton instance of StaticDatabaseManager
   */
  public static async getInstance(): Promise<StaticDatabaseManager> {
    if (!StaticDatabaseManager.instance) {
      console.warn(
        '[StaticDB] ⚠️ Database not initialized, creating new instance...'
      );
      StaticDatabaseManager.instance = new StaticDatabaseManager();
    }

    if (!StaticDatabaseManager.instance.isReady) {
      if (!StaticDatabaseManager.initializationPromise) {
        console.warn('[StaticDB] ⚠️ Database not ready, initializing...');
        StaticDatabaseManager.initializationPromise =
          StaticDatabaseManager.instance
            .initializeDatabase()
            .then(() => {
              console.log('[StaticDB] ✅ Database initialized successfully.');
            })
            .catch((err) => {
              console.error(
                '[StaticDB] ❌ Failed to initialize database:',
                err
              );
              throw err; // Ensure the error propagates
            })
            .finally(() => {
              StaticDatabaseManager.initializationPromise = null;
            });
      }

      await StaticDatabaseManager.initializationPromise; // Wait for initialization to finish
    }

    return StaticDatabaseManager.instance;
  }

  public static getDefaultInstance(): StaticDatabaseManager {
    if (!StaticDatabaseManager.instance) {
      StaticDatabaseManager.instance = new StaticDatabaseManager();
    }
    return StaticDatabaseManager.instance;
  }

  // Add this method to StaticDatabaseManager class
  public async loadManufacturersCache(limit: number = 50): Promise<boolean> {
    try {
      console.log(
        `[StaticDB] 🔄 Loading top ${limit} manufacturers by aircraft count...`
      );

      // More explicit query that focuses on getting top manufacturers by count
      const result = await this.executeQuery<ManufacturerInfo>(
        `SELECT 
        TRIM(manufacturer) AS name,
        COUNT(*) AS count
      FROM aircraft
      WHERE manufacturer IS NOT NULL AND TRIM(manufacturer) != ''
      GROUP BY TRIM(manufacturer)
      ORDER BY count DESC
      LIMIT ?`,
        [limit]
      );

      // Log the results for debugging
      console.log(`[StaticDB] Query returned ${result.length} manufacturers`);
      if (result.length > 0) {
        console.log(
          `[StaticDB] Top manufacturer: ${result[0].name} with ${result[0].count} aircraft`
        );
      }

      // Only cache if we have results
      if (result.length > 0) {
        await this.manufacturerListCache.set(
          this.MANUFACTURER_LIST_CACHE_KEY,
          result
        );
        console.log(
          `[StaticDB] ✅ Cached top ${result.length} manufacturers by aircraft count`
        );
        return true;
      } else {
        console.log('[StaticDB] ⚠️ No manufacturers found to cache');
        return false;
      }
    } catch (error) {
      console.error('[StaticDB] ❌ Error loading manufacturers cache:', error);
      return false;
    }
  }

  protected async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS aircraft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        "N-NUMBER" TEXT,
        icao24 TEXT UNIQUE,
        manufacturer TEXT,
        model TEXT,
        owner TEXT,
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

    // Check the row count first
    const countResult = await this.executeQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM aircraft'
    );
    const rowCount = countResult[0]?.count || 0;
    console.log(`[StaticDB] Aircraft table has ${rowCount} rows`);

    if (rowCount > 0) {
      // Force load the manufacturers cache if we have data
      const success = await this.loadManufacturersCache(50);
      if (success) {
        console.log(
          '[StaticDB] ✅ Top 50 manufacturers cached successfully during initialization'
        );
      } else {
        console.warn(
          '[StaticDB] ⚠️ Failed to cache manufacturers during initialization'
        );
      }
    } else {
      console.warn(
        '[StaticDB] ⚠️ Skipping manufacturer cache - no aircraft data found'
      );
    }
  }

  private async getValidManufacturers(
    limit: number = 50
  ): Promise<Set<string>> {
    const cached = await this.manufacturerValidationCache.get(
      this.MANUFACTURER_VALIDATION_CACHE_KEY
    );
    if (cached) {
      console.log(
        `[StaticDB] Using cached manufacturer validation list (Top ${limit})`
      );
      return cached;
    }

    console.log(
      `[StaticDB] Fetching top ${limit} manufacturers for validation from database`
    );

    const query = `
    SELECT manufacturer
    FROM (
      SELECT 
        TRIM(manufacturer) AS manufacturer, 
        COUNT(*) AS count
      FROM aircraft 
      WHERE manufacturer IS NOT NULL 
      AND TRIM(manufacturer) != ''
      GROUP BY TRIM(manufacturer)
      ORDER BY count DESC
      LIMIT ?
    ) AS TopManufacturers
  `;

    const results = await this.executeQuery<{ manufacturer: string }>(query, [
      limit,
    ]);
    const manufacturers = new Set(
      results.map((r) => r.manufacturer.trim().toUpperCase())
    );

    await this.manufacturerValidationCache.set(
      this.MANUFACTURER_VALIDATION_CACHE_KEY,
      manufacturers
    );

    console.log(
      `[StaticDB] Cached ${manufacturers.size} top manufacturers for validation`
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

    if (cached) {
      console.log(`[StaticDB] Using cached ICAO24s for ${manufacturer}`);
      return cached;
    }

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
      const icao24List = results
        .map((item) => item.icao24.toLowerCase())
        .filter((icao24) => /^[0-9a-f]{6}$/.test(icao24));

      await this.icao24Cache.set(cacheKey, icao24List);
      console.log(
        `[StaticDB] Cached ${icao24List.length} ICAO24s for ${manufacturer}`
      );

      return icao24List;
    } catch (error) {
      console.error('[StaticDB] Failed to fetch ICAO24s:', error);
      throw new Error(
        error instanceof Error
          ? `Failed to fetch ICAO24s: ${error.message}`
          : 'Failed to fetch ICAO24s'
      );
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

    // Add this to your getManufacturersWithCount method just before executing the query
    console.log('[StaticDB] Checking database tables...');
    const tablesQuery = await this.executeQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    console.log(
      `[StaticDB] Available tables: ${tablesQuery.map((t) => t.name).join(', ')}`
    );

    // Add a row count check
    console.log('[StaticDB] Checking aircraft table row count...');
    const countQuery = await this.executeQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM aircraft'
    );
    console.log(
      `[StaticDB] Aircraft table has ${countQuery[0]?.count || 0} rows`
    );

    // Check if manufacturers exist
    console.log('[StaticDB] Checking for manufacturers...');
    const manufacturerQuery = await this.executeQuery<{ count: number }>(
      'SELECT COUNT(DISTINCT manufacturer) as count FROM aircraft WHERE manufacturer IS NOT NULL'
    );
    console.log(
      `[StaticDB] Found ${manufacturerQuery[0]?.count || 0} distinct manufacturers`
    );

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
    try {
      await this.ensureInitialized();

      console.log(
        `[StaticDB] 📊 Fetching models for manufacturer: ${manufacturer}`
      );

      const modelQuery = `
      SELECT 
        model,
        manufacturer,
        COUNT(DISTINCT icao24) as total_count,
        GROUP_CONCAT(icao24) as icao_list,
        MAX(NAME) as name,
        MAX(CITY) as city,
        MAX(STATE) as state,
        MAX(OWNER_TYPE) as ownerType
      FROM aircraft
      WHERE manufacturer = ?
      GROUP BY model, manufacturer
      ORDER BY total_count DESC;
      `;

      const modelResults = await this.executeQuery<{
        model: string;
        manufacturer: string;
        total_count: number;
        icao_list: string;
        city: string;
        ownerType: string;
        state: string;
        name: string;
      }>(modelQuery, [manufacturer]);

      if (modelResults.length === 0) {
        console.log(
          `[StaticDB] ❌ No models found for manufacturer: ${manufacturer}`
        );
        return [];
      }

      console.log(`[StaticDB] ✅ Found ${modelResults.length} models`);

      // Get active counts by importing the tracking manager here instead of at the top
      let activeCountMap = new Map<string, number>();

      try {
        // Lazy-load the tracking database manager to avoid circular dependency
        const { default: trackingDatabaseManagerPromise } = await import(
          './trackingDatabaseManager'
        );
        // Make sure to await the promise to get the actual manager
        const trackingManager = await trackingDatabaseManagerPromise;
        const trackedAircraft =
          await trackingManager.getTrackedAircraft(manufacturer);

        // Create a map of active aircraft counts by ICAO24
        trackedAircraft.forEach((aircraft: Aircraft) => {
          if (aircraft.icao24) {
            const icao = aircraft.icao24.toLowerCase();
            activeCountMap.set(icao, (activeCountMap.get(icao) || 0) + 1);
          }
        });
      } catch (trackingError) {
        console.warn(
          '[StaticDB] ⚠️ Could not fetch tracking data:',
          trackingError
        );
        // Continue with zero active counts
      }

      // Process each model
      return modelResults.map((result) => {
        const icaos = result.icao_list
          ? result.icao_list.split(',').map((icao) => icao.trim().toLowerCase())
          : [];

        // Count active aircraft for this model
        const activeCount = icaos.reduce(
          (count, icao) => count + (activeCountMap.get(icao) || 0),
          0
        );

        return {
          model: result.model,
          manufacturer: result.manufacturer,
          totalCount: result.total_count,
          count: result.total_count,
          activeCount,
          city: result.city || 'Unknown',
          state: result.state || 'Unknown',
          ownerType: result.ownerType || 'Unknown',
          name: result.name || 'Unknown',
        };
      });
    } catch (error) {
      console.error('[StaticDB] ❌ Failed to fetch models:', error);
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

    console.log(`[StaticDB] Fetching data for ${icao24s.length} aircraft`);

    // Check cache for existing aircraft data
    const cachedResults: Record<string, AircraftRecord[]> =
      await this.aircraftCache.getMultiple(
        icao24s.map((code) => `${this.ICAO24_CACHE_PREFIX}${code}`)
      );

    const cachedAircraft = Object.values(cachedResults).flat();
    const missingIcao24s = icao24s.filter(
      (code) => !cachedResults[`${this.ICAO24_CACHE_PREFIX}${code}`]
    );

    if (missingIcao24s.length === 0) {
      console.log(`[StaticDB] ✅ Returning cached aircraft data`);
      return cachedAircraft;
    }

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

      const cacheEntries: Record<string, AircraftRecord[]> = {};
      fetchedAircraft.forEach((aircraft) => {
        cacheEntries[`${this.ICAO24_CACHE_PREFIX}${aircraft.icao24}`] = [
          aircraft,
        ];
      });
      await this.aircraftCache.setMultiple(cacheEntries);
    } catch (error) {
      console.error(`[StaticDB] ❌ Error fetching aircraft data: ${error}`);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Unknown error fetching aircraft data'
      );
    }

    return [...cachedAircraft, ...fetchedAircraft];
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
    SELECT * FROM aircraft WHERE "N-NUMBER" = ? LIMIT 1;
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
