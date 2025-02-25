class Icao24CacheService {
  private cache: Map<string, string[]> = new Map();
  private pendingRequests: Map<string, Promise<string[]>> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getIcao24s(manufacturer: string): Promise<string[]> {
    if (!manufacturer) return [];

    // ✅ Step 1: Check cache
    if (this.cache.has(manufacturer)) {
      console.log(
        `[Icao24CacheService] ✅ Using cached ICAO24s for ${manufacturer}`
      );
      return this.cache.get(manufacturer)!;
    }

    // ✅ Step 2: Check if request is already pending
    if (this.pendingRequests.has(manufacturer)) {
      console.log(`[Icao24CacheService] 🚧 Waiting for existing request...`);
      return this.pendingRequests.get(manufacturer)!;
    }

    // ✅ Step 3: Fetch from API
    console.log(`[Icao24CacheService] 🔄 Fetching ICAO24s for ${manufacturer}`);

    const fetchPromise = fetch('/api/aircraft/icao24s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `[Icao24CacheService] ❌ Failed to fetch ICAO24s: ${response.statusText}`
          );
        }
        const data = await response.json();
        const icaoList = data?.data?.icao24List ?? [];

        // ✅ Cache result
        this.cache.set(manufacturer, icaoList);
        setTimeout(() => this.cache.delete(manufacturer), this.CACHE_DURATION);

        return icaoList;
      })
      .catch((error) => {
        console.error(`[Icao24CacheService] ❌ Error fetching ICAO24s:`, error);
        return [];
      })
      .finally(() => {
        this.pendingRequests.delete(manufacturer);
      });

    // ✅ Store pending request to avoid duplicate fetches
    this.pendingRequests.set(manufacturer, fetchPromise);
    return fetchPromise;
  }
}

// ✅ Singleton instance
export const icao24CacheService = new Icao24CacheService();
