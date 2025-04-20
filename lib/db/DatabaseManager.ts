// SimplifiedDatabaseManager.ts
import path from 'path';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import fs from 'fs';

// Type definitions
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in seconds
}

type CacheStorage = {
  [key: string]: CacheEntry<any>;
};

// The main database manager class
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: Database<sqlite3.Database> | null = null;
  private isInitialized = false;
  private dbPath: string;
  private cache: CacheStorage = {};

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
    console.log(`[DB] Database path: ${this.dbPath}`);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      // First try to use the provided dbPath parameter
      if (dbPath) {
        DatabaseManager.instance = new DatabaseManager(dbPath);
      } else {
        // Otherwise, try to use the environment variable
        const envPath = process.env.STATIC_DB_PATH;
        if (!envPath) {
          throw new Error('STATIC_DB_PATH not defined in .env');
        }
        DatabaseManager.instance = new DatabaseManager(envPath);
      }
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize the database connection and create tables if needed
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      // Set pragmas for better performance
      await this.db.run('PRAGMA journal_mode = WAL;');
      await this.db.run('PRAGMA busy_timeout = 5000;');

      this.isInitialized = true;
      console.log('[DB] Database initialized successfully');
    } catch (error) {
      console.error('[DB] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Get data with caching
   */
  public async query<T>(
    cacheKey: string,
    sqlQuery: string,
    params: any[] = [],
    ttl: number = 300 // 5 minutes default TTL
  ): Promise<T[]> {
    // Check if we need to initialize first
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try to get from cache first
    const cachedData = this.getFromCache<T[]>(cacheKey);
    if (cachedData) {
      console.log(`[DB] Cache hit for: ${cacheKey}`);
      return cachedData;
    }

    // Cache miss, execute query
    console.log(`[DB] Cache miss for: ${cacheKey}, executing query`);
    try {
      const results = await this.db!.all<T[]>(sqlQuery, params);

      // Store in cache
      this.setInCache(cacheKey, results, ttl);

      return results;
    } catch (error) {
      console.error(`[DB] Query error for ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Get single item with caching
   */
  public async getSingle<T>(
    cacheKey: string,
    sqlQuery: string,
    params: any[] = [],
    ttl: number = 300
  ): Promise<T | null> {
    // Check if we need to initialize first
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try to get from cache first
    const cachedData = this.getFromCache<T | null>(cacheKey);
    if (cachedData !== undefined) {
      console.log(`[DB] Cache hit for: ${cacheKey}`);
      return cachedData;
    }

    // Cache miss, execute query
    console.log(`[DB] Cache miss for: ${cacheKey}, executing query`);
    try {
      const result = await this.db!.get<T>(sqlQuery, params);

      // Store in cache (even if null)
      this.setInCache(cacheKey, result || null, ttl);

      return result || null;
    } catch (error) {
      console.error(`[DB] Query error for ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Get manufacturers with aircraft count
   */
  public async getManufacturersWithCount(
    limit: number = 75
  ): Promise<{ name: string; count: number }[]> {
    const cacheKey = `manufacturers-count-${limit}`;

    // Query with exact column case matching your schema
    return this.query<{ name: string; count: number }>(
      cacheKey,
      `SELECT 
      MANUFACTURER AS name,  
      COUNT(*) AS count 
    FROM aircraft 
    WHERE MANUFACTURER IS NOT NULL AND trim(MANUFACTURER) != '' 
    GROUP BY MANUFACTURER 
    HAVING count > 0 
    ORDER BY count DESC 
    LIMIT ?`,
      [limit],
      600 // 10 minute cache
    );
  }

  public async getIcao24sForManufacturer(
    manufacturer: string,
    region?: number | string
  ): Promise<string[]> {
    if (!this.isInitialized) {
      console.log('[DB] Not initialized, calling initialize()');
      await this.initialize();
    }

    const cacheKey = region
      ? `ICAO24s-${manufacturer.toUpperCase()}-${region}`
      : `ICAO24s-${manufacturer.toUpperCase()}`;

    const cachedData = this.getFromCache<string[]>(cacheKey);
    if (cachedData) {
      console.log(`[DB] Cache hit for: ${cacheKey}`);
      return cachedData;
    }

    console.log(`[DB] Cache miss for: ${cacheKey}, executing query`);
    try {
      const queryParts = [
        `SELECT DISTINCT ICAO24 FROM aircraft`,
        `WHERE LOWER(MANUFACTURER) = LOWER(?)`,
        `AND ICAO24 IS NOT NULL`,
      ];
      const queryParams: any[] = [manufacturer];

      // Add region filtering if region is specified
      if (region !== undefined) {
        // Check if region is a number or string
        if (typeof region === 'string' && !isNaN(parseInt(region, 10))) {
          // If it's a numeric string, convert to number
          queryParts.push(`AND REGION = ?`);
          queryParams.push(parseInt(region, 10));
        } else if (typeof region === 'number') {
          // If it's already a number
          queryParts.push(`AND REGION = ?`);
          queryParams.push(region);
        } else {
          // Assume it's a state string
          queryParts.push(`AND LOWER(STATE) = LOWER(?)`);
          queryParams.push(region as string);
        }
      }

      const query = queryParts.join(' ');
      const result = await this.db!.all<{ ICAO24: string }[]>(
        query,
        queryParams
      );

      const ICAO24s = result.map((row) => row.ICAO24.toLowerCase());
      console.log(
        `[DB] Retrieved ${ICAO24s.length} ICAO24s for ${manufacturer}${region ? ` in region/state ${region}` : ''}`
      );

      this.setInCache(cacheKey, ICAO24s, 300);
      return ICAO24s;
    } catch (error) {
      console.error(
        `[DB] Error retrieving ICAO24s for manufacturer ${manufacturer}${region ? ` in region/state ${region}` : ''}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get aircraft by ICAO24 codes
   */
  public async getAircraftByIcao24s(ICAO24s: string[]): Promise<any[]> {
    if (!Array.isArray(ICAO24s) || ICAO24s.length === 0) {
      return [];
    }

    // Get individual aircraft from cache if possible
    const result: any[] = [];
    const missingIcao24s: string[] = [];

    for (const icao of ICAO24s) {
      const cachedAircraft = this.getFromCache<any>(`aircraft-${icao}`);
      if (cachedAircraft) {
        result.push(cachedAircraft);
      } else {
        missingIcao24s.push(icao);
      }
    }

    // Fetch any missing aircraft
    if (missingIcao24s.length > 0) {
      const placeholders = missingIcao24s.map(() => '?').join(',');
      const query = `
        SELECT *
        FROM aircraft
        WHERE ICAO24 IN (${placeholders})
      `;

      const fetchedAircraft = await this.query<any>(
        `aircraft-batch-${Date.now()}`, // Unique key to bypass cache
        query,
        missingIcao24s,
        0 // Don't cache the batch query result
      );

      // Cache individual results
      for (const aircraft of fetchedAircraft) {
        this.setInCache(`aircraft-${aircraft.ICAO24}`, aircraft, 300);
        result.push(aircraft);
      }
    }

    return result;
  }

  /**
   * Get models by MANUFACTURER
   */
  public async getModelsByManufacturer(MANUFACTURER: string): Promise<any[]> {
    const cacheKey = `models-${MANUFACTURER}`;

    return this.query<any>(
      cacheKey,
      `SELECT 
        MODEL,
        MANUFACTURER,
        COUNT(DISTINCT ICAO24) as total_count,
        MAX(NAME) as NAME,
        MAX(CITY) as CITY,
        MAX(STATE) as STATE,
        MAX(TYPE_REGISTRANT) as TYPE_REGISTRANT
      FROM aircraft
      WHERE MANUFACTURER = ?
      GROUP BY MODEL, MANUFACTURER
      ORDER BY total_count DESC`,
      [MANUFACTURER],
      300 // 5 minute cache
    );
  }

  /**
   * Store data in cache
   */
  private setInCache<T>(key: string, data: T, ttl: number): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
    };
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string): T | undefined {
    const entry = this.cache[key];

    if (!entry) return undefined;

    // Check if cache entry is still valid
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      // Cache expired
      delete this.cache[key];
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Clear entire cache or specific keys
   */
  public clearCache(key?: string): void {
    if (key) {
      delete this.cache[key];
      console.log(`[DB] Cleared cache for: ${key}`);
    } else {
      this.cache = {};
      console.log('[DB] Cleared entire cache');
    }
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[DB] Database connection closed');
    }
  }
}

// Export a singleton instance
const dbManager = DatabaseManager.getInstance();
export default dbManager;
