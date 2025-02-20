// lib/db/staticDatabaseManager.ts
import { BaseDatabaseManager } from '../../../lib/db/managers/baseDatabaseManager';
import CacheManager from '@/lib/services/managers/cache-manager';

// Cache manufacturer validation results for 1 hour
const manufacturerCache = new CacheManager<Set<string>>(60 * 60);
const MANUFACTURER_CACHE_KEY = 'valid-manufacturers';

class StaticDatabaseManager extends BaseDatabaseManager {
  private static instance: StaticDatabaseManager | null = null;
  private readonly icaoCache = new CacheManager<string[]>(5 * 60);

  private constructor() {
    super('static.db');
  }

  public static getInstance(): StaticDatabaseManager {
    if (!StaticDatabaseManager.instance) {
      StaticDatabaseManager.instance = new StaticDatabaseManager();
    }
    return StaticDatabaseManager.instance;
  }

  // Implement the abstract createTables method
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

  private async getValidManufacturers(): Promise<Set<string>> {
    const cached = await manufacturerCache.get(MANUFACTURER_CACHE_KEY);
    if (cached) {
      console.log('[StaticDB] Using cached manufacturer list');
      return cached;
    }

    console.log('[StaticDB] Fetching manufacturer list from database');
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

    await manufacturerCache.set(MANUFACTURER_CACHE_KEY, manufacturers);
    console.log(`[StaticDB] Cached ${manufacturers.size} manufacturers`);

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

    const cached = await this.icaoCache.get(cacheKey);
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

      await this.icaoCache.set(cacheKey, icao24List);
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

  // Method to invalidate caches if needed
  public async invalidateCaches(): Promise<void> {
    await Promise.all([
      manufacturerCache.delete(MANUFACTURER_CACHE_KEY),
      // Delete all ICAO caches individually since we don't have a clear method
      this.icaoCache.delete('*'),
    ]);
    console.log('[StaticDB] Caches invalidated');
  }
}

const staticDatabaseManager = StaticDatabaseManager.getInstance();
export { StaticDatabaseManager };
export default staticDatabaseManager;
