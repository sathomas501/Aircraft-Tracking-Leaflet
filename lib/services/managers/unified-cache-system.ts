import { CachedAircraftData } from "../../../types/base";

class UnifiedCacheService {
  private static instance: UnifiedCacheService;
  private cache: Map<string, CachedAircraftData[]>;

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService();
    }
    return UnifiedCacheService.instance;
  }

  // ✅ Fixed GET method
  public getLiveData(manufacturer: string): CachedAircraftData[] {
    const key = manufacturer.trim().toUpperCase();
    console.log(`[Cache Debug] GET key: ${key}, Exists: ${this.cache.has(key)}`);
    return this.cache.get(key) || []; // ✅ Use .get() instead of bracket notation
  }

  // ✅ Fixed SET method
  public setLiveData(manufacturer: string, data: CachedAircraftData[]): void {
    const key = manufacturer.trim().toUpperCase();
    this.cache.set(key, data); // ✅ Use .set() instead of bracket notation
    console.log(`[Cache Debug] SET key: ${key}, Data Length: ${data.length}`);
  }
}

export default UnifiedCacheService;


