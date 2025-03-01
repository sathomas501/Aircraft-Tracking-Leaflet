class Icao24CacheService {
  private cache: Map<string, string[]> = new Map();
  private pendingRequests: Map<string, Promise<string[]>> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getIcao24s(manufacturer: string): Promise<string[]> {
    if (!manufacturer) return [];

    return this.cache.get(manufacturer) ?? [];
  }

  /**
   * ✅ Stores ICAO24s in the cache
   */
  cacheIcaos(manufacturer: string, icao24s: string[]): void {
    if (!manufacturer || !icao24s.length) return;

    const existing = this.cache.get(manufacturer) ?? [];
    this.cache.set(manufacturer, [...new Set([...existing, ...icao24s])]);

    // Expire cache after `CACHE_DURATION`
    setTimeout(() => this.cache.delete(manufacturer), this.CACHE_DURATION);
  }

  /**
   * ✅ Fetch ICAO24s with caching
   */
  async fetchAndCacheIcao24s(
    manufacturer: string,
    fetchFunction: () => Promise<string[]>
  ): Promise<string[]> {
    if (!manufacturer) return [];

    // ✅ Step 1: Check cache first
    if (this.cache.has(manufacturer)) {
      console.log(
        `[Icao24CacheService] ✅ Using cached ICAO24s for ${manufacturer}`
      );
      return this.cache.get(manufacturer) ?? [];
    }

    // ✅ Step 2: Prevent duplicate fetches
    if (this.pendingRequests.has(manufacturer)) {
      console.log(
        `[Icao24CacheService] 🚧 Waiting for an existing fetch request...`
      );
      return this.pendingRequests.get(manufacturer)!;
    }

    // ✅ Step 3: Fetch ICAOs
    console.log(
      `[Icao24CacheService] 🔄 Fetching ICAO24s for ${manufacturer}...`
    );
    const fetchPromise = fetchFunction()
      .then((icaoList) => {
        this.cacheIcaos(manufacturer, icaoList);
        return icaoList;
      })
      .catch((error) => {
        console.error(`[Icao24CacheService] ❌ Error fetching ICAO24s:`, error);
        return [];
      })
      .finally(() => {
        this.pendingRequests.delete(manufacturer);
      });

    // ✅ Store pending request
    this.pendingRequests.set(manufacturer, fetchPromise);
    return fetchPromise;
  }
}

// ✅ Singleton instance
export const icao24CacheService = new Icao24CacheService();
