import { TrackingDatabaseManager } from '../../db/managers/trackingDatabaseManager';

type AircraftData = {
  icao24: string;
  manufacturer: string;
  model: string;
  operator?: string;
  city?: string;
  state?: string;
};

class TrackingService {
  private static activeIcaoCache: Set<string> = new Set();
  private static staticAircraftCache: Map<string, AircraftData> = new Map();

  /**
   * Refreshes the active ICAO cache from the tracking database.
   */
  static async refreshActiveIcaoCache() {
    const db = await TrackingDatabaseManager.getInstance();
    const query = `SELECT icao24 FROM tracked_aircraft`;

    try {
      const activeResults = await db.getAll<{ icao24: string }>(query);
      this.activeIcaoCache = new Set(activeResults.map((row) => row.icao24));

      console.log(
        `🔄 Refreshed active ICAO cache. Tracking ${this.activeIcaoCache.size} aircraft.`
      );
    } catch (error) {
      console.error('❌ Error refreshing ICAO cache:', error);
    }
  }

  /**
   * Returns ICAOs that are not already in the cache.
   */
  static getNewIcaos(allIcaos: string[]): string[] {
    return allIcaos.filter((icao) => !this.activeIcaoCache.has(icao));
  }

  /**
   * Marks ICAOs as active in the cache.
   */
  static markIcaosAsActive(icaos: string[]) {
    icaos.forEach((icao) => this.activeIcaoCache.add(icao));
    console.log(`✅ Marked ${icaos.length} ICAOs as active.`);
  }

  /**
   * Caches static aircraft data to be used while waiting for OpenSky results.
   */
  static cacheStaticAircraft(aircraftList: AircraftData[]) {
    aircraftList.forEach((aircraft) => {
      this.staticAircraftCache.set(aircraft.icao24, aircraft);
    });
    console.log(
      `📌 Cached ${aircraftList.length} static aircraft records for temporary use.`
    );
  }

  /**
   * Retrieves static aircraft data from the cache.
   */
  static getStaticAircraft(icao24: string): AircraftData | null {
    return this.staticAircraftCache.get(icao24) || null;
  }

  /**
   * Clears static aircraft cache (if needed)
   */
  static clearStaticCache() {
    this.staticAircraftCache.clear();
    console.log(`🗑️ Cleared static aircraft cache.`);
  }
}

export default TrackingService;
