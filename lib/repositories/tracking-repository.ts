// lib/repositories/tracking-repository.ts
import { BaseDatabaseManager } from '../db/managers/baseDatabaseManager';

interface DatabaseState {
  isReady: boolean;
  tables: string[];
  cacheStatus: {
    manufacturersAge: number | null;
    icaosAge: number | null;
  };
  counts: {
    pending: number;
    active: number;
    stale: number;
    total: number;
  };
}

export class TrackingRepository {
  private dbManager: BaseDatabaseManager;

  constructor(dbManager: BaseDatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Get current state of the tracking database
   */
  async getDatabaseState(): Promise<DatabaseState> {
    try {
      // Get list of tables
      const tables = !this.dbManager.isReady
        ? []
        : await this.dbManager
            .executeQuery<{
              name: string;
            }>("SELECT name FROM sqlite_master WHERE type='table'")
            .then((results) => results.map((r) => r.name));

      // Check if required tables exist
      const hasRequiredTables = tables.includes('tracked_aircraft');

      // Get counts for different status types
      let pendingCount = 0;
      let activeCount = 0;
      let staleCount = 0;

      if (this.dbManager.isReady && hasRequiredTables) {
        const pendingResult = await this.dbManager.executeQuery<{
          count: number;
        }>(
          "SELECT COUNT(*) as count FROM tracked_aircraft WHERE status = 'pending'"
        );
        pendingCount = pendingResult[0]?.count || 0;

        const activeResult = await this.dbManager.executeQuery<{
          count: number;
        }>(
          "SELECT COUNT(*) as count FROM tracked_aircraft WHERE status = 'active'"
        );
        activeCount = activeResult[0]?.count || 0;

        const staleResult = await this.dbManager.executeQuery<{
          count: number;
        }>(
          "SELECT COUNT(*) as count FROM tracked_aircraft WHERE status = 'stale'"
        );
        staleCount = staleResult[0]?.count || 0;
      }

      return {
        isReady: this.dbManager.isReady && hasRequiredTables,
        tables,
        cacheStatus: {
          manufacturersAge: null, // TrackingDB doesn't cache manufacturers
          icaosAge: null, // TrackingDB doesn't cache ICAOs
        },
        counts: {
          pending: pendingCount,
          active: activeCount,
          stale: staleCount,
          total: pendingCount + activeCount + staleCount,
        },
      };
    } catch (error) {
      console.error(
        '[TrackingRepository] Failed to get database state:',
        error
      );
      return {
        isReady: false,
        tables: [],
        cacheStatus: {
          manufacturersAge: null,
          icaosAge: null,
        },
        counts: {
          pending: 0,
          active: 0,
          stale: 0,
          total: 0,
        },
      };
    }
  }

  /**
   * Check if the database connection is valid
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.dbManager.ensureInitialized();
      await this.dbManager.executeQuery('SELECT 1');
      return true;
    } catch (error) {
      console.error('[TrackingRepository] Connection check failed:', error);
      return false;
    }
  }

  /**
   * Add aircraft to tracking with 'pending' status
   */
  async addPendingAircraft(
    icao24s: string[],
    manufacturer: string
  ): Promise<number> {
    if (!icao24s.length) {
      console.log('[TrackingRepository] No aircraft to add as pending');
      return 0;
    }

    await this.dbManager.ensureInitialized();
    const currentTime = Math.floor(Date.now() / 1000);

    try {
      console.log(
        `[TrackingRepository] Adding ${icao24s.length} aircraft as pending for ${manufacturer}`
      );

      let successCount = 0;

      // Prepare the statement
      const db = await this.dbManager.getDatabase();
      if (!db) {
        throw new Error(
          '[TrackingRepository] Database connection not initialized'
        );
      }

      const stmt = await db.prepare(`
      INSERT INTO tracked_aircraft (
        icao24, manufacturer, status, latitude, longitude,
        altitude, velocity, heading, on_ground, last_contact, updated_at
      ) VALUES (?, ?, 'pending', 0, 0, 0, 0, 0, 1, ?, ?)
      ON CONFLICT(icao24) DO UPDATE SET
        manufacturer = COALESCE(excluded.manufacturer, tracked_aircraft.manufacturer),
        status = 'pending',
        updated_at = excluded.updated_at
      `);

      // Process aircraft
      for (const icao24 of icao24s) {
        try {
          await stmt.run(
            icao24,
            manufacturer,
            currentTime - 48 * 60 * 60, // Old timestamp to make it stale
            currentTime
          );
          successCount++;
        } catch (error) {
          console.error(
            `[TrackingRepository] Error adding pending aircraft ${icao24}:`,
            error
          );
        }
      }

      // Finalize statement
      await stmt.finalize();

      console.log(
        `[TrackingRepository] Successfully added ${successCount} pending aircraft`
      );
      return successCount;
    } catch (error) {
      console.error(
        '[TrackingRepository] Failed to add pending aircraft:',
        error
      );
      throw error;
    }
  }

  /**
   * Get all pending aircraft that need position data
   */
  async getPendingIcao24s(manufacturer?: string): Promise<string[]> {
    await this.dbManager.ensureInitialized();

    try {
      let query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE status = 'pending'
      AND icao24 IS NOT NULL
      `;

      const params: any[] = [];

      if (manufacturer) {
        query += ` AND manufacturer = ?`;
        params.push(manufacturer);
      }

      const rows = await this.dbManager.executeQuery<{ icao24: string }>(
        query,
        params
      );
      console.log(
        `[TrackingRepository] Found ${rows.length} pending ICAOs${manufacturer ? ` for ${manufacturer}` : ''}`
      );

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error(
        '[TrackingRepository] Failed to fetch pending ICAOs:',
        error
      );
      return [];
    }
  }

  /**
   * Mark aircraft as active with position data
   */
  async markAsActive(
    icao24: string,
    latitude: number,
    longitude: number,
    altitude: number = 0,
    velocity: number = 0,
    heading: number = 0,
    on_ground: boolean = false
  ): Promise<boolean> {
    await this.dbManager.ensureInitialized();

    const currentTime = Math.floor(Date.now() / 1000);

    try {
      const query = `
      UPDATE tracked_aircraft
      SET 
        status = 'active',
        latitude = ?,
        longitude = ?,
        altitude = ?,
        velocity = ?,
        heading = ?,
        on_ground = ?,
        last_contact = ?,
        updated_at = ?
      WHERE icao24 = ?
      `;

      await this.dbManager.executeQuery(query, [
        latitude,
        longitude,
        altitude,
        velocity,
        heading,
        on_ground ? 1 : 0,
        currentTime,
        currentTime,
        icao24,
      ]);

      return true;
    } catch (error) {
      console.error(
        `[TrackingRepository] Failed to mark aircraft ${icao24} as active:`,
        error
      );
      return false;
    }
  }

  /**
   * Perform maintenance to clean up and mark stale aircraft
   */
  async performMaintenance(): Promise<{
    cleaned: number;
    marked: number;
  }> {
    await this.dbManager.ensureInitialized();

    try {
      await this.dbManager.executeQuery('BEGIN TRANSACTION');

      // Mark old active aircraft as stale
      const staleThreshold = Math.floor(Date.now() / 1000) - 30 * 60; // 30 minutes
      const markStaleResult = await this.dbManager.executeQuery<{
        changes: number;
      }>(
        `UPDATE tracked_aircraft 
         SET status = 'stale' 
         WHERE status = 'active' AND last_contact < ?
         RETURNING changes()`,
        [staleThreshold]
      );

      // Delete very old stale records
      const deleteThreshold = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // 7 days
      const deleteResult = await this.dbManager.executeQuery<{
        changes: number;
      }>(
        `DELETE FROM tracked_aircraft 
         WHERE status = 'stale' AND last_contact < ?
         RETURNING changes()`,
        [deleteThreshold]
      );

      await this.dbManager.executeQuery('COMMIT');

      return {
        marked: markStaleResult[0]?.changes || 0,
        cleaned: deleteResult[0]?.changes || 0,
      };
    } catch (error) {
      await this.dbManager.executeQuery('ROLLBACK');
      console.error('[TrackingRepository] Maintenance failed:', error);
      throw error;
    }
  }

  /**
   * Update statuses of all aircraft
   */
  async updateAircraftStatus(): Promise<void> {
    await this.dbManager.ensureInitialized();

    console.log('[TrackingRepository] Updating aircraft statuses...');

    try {
      const now = Math.floor(Date.now() / 1000); // Current timestamp
      const activeThreshold = now - 600; // 10 minutes for active
      const staleThreshold = now - 3600; // 1 hour for stale

      await this.dbManager.executeQuery(
        `
        UPDATE tracked_aircraft
        SET status = 
          CASE 
            WHEN last_contact >= ? THEN 'active'
            WHEN last_contact >= ? THEN 'stale'
            ELSE 'pending'
          END
        `,
        [activeThreshold, staleThreshold]
      );

      console.log('[TrackingRepository] Aircraft statuses updated.');
    } catch (error) {
      console.error(
        '[TrackingRepository] Failed to update aircraft statuses:',
        error
      );
      throw error;
    }
  }

  /**
   * Get active aircraft ICAOs (with recent position data)
   */
  async getActiveIcao24s(manufacturer?: string): Promise<string[]> {
    await this.dbManager.ensureInitialized();

    // Active means status='active' and recent timestamp
    const activeThreshold = Math.floor(Date.now() / 1000) - 30 * 60; // 30 minutes

    try {
      let query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE status = 'active'
      AND last_contact > ?
      AND icao24 IS NOT NULL
      AND latitude != 0 AND longitude != 0
      `;

      const params: any[] = [activeThreshold];

      if (manufacturer) {
        query += ` AND manufacturer = ?`;
        params.push(manufacturer);
      }

      const rows = await this.dbManager.executeQuery<{ icao24: string }>(
        query,
        params
      );
      console.log(
        `[TrackingRepository] Found ${rows.length} active ICAOs${manufacturer ? ` for ${manufacturer}` : ''}`
      );

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error(
        '[TrackingRepository] Failed to fetch active ICAOs:',
        error
      );
      return [];
    }
  }

  /**
   * Get stale aircraft ICAOs (need refreshing)
   */
  async getStaleIcao24s(manufacturer?: string): Promise<string[]> {
    await this.dbManager.ensureInitialized();

    // Stale means older than 30 minutes but newer than 24 hours
    const staleStart = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 24 hours ago
    const staleEnd = Math.floor(Date.now() / 1000) - 30 * 60; // 30 minutes ago

    try {
      let query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE status = 'active'
      AND last_contact > ? AND last_contact < ?
      AND icao24 IS NOT NULL
      `;

      const params: any[] = [staleStart, staleEnd];

      if (manufacturer) {
        query += ` AND manufacturer = ?`;
        params.push(manufacturer);
      }

      const rows = await this.dbManager.executeQuery<{ icao24: string }>(
        query,
        params
      );
      console.log(
        `[TrackingRepository] Found ${rows.length} stale ICAOs${manufacturer ? ` for ${manufacturer}` : ''}`
      );

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error('[TrackingRepository] Failed to fetch stale ICAOs:', error);
      return [];
    }
  }
}
