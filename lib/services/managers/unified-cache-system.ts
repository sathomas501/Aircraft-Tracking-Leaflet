import { CachedAircraftData } from "@/types/base";

export type UnsubscribeFunction = () => void;

interface CacheEntry {
  data: CachedAircraftData[];
  timestamp: number;
  subscriptions: Set<(data: CachedAircraftData[]) => void>;
}

class UnifiedCacheService {
  private static instance: UnifiedCacheService;
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService();
    }
    return UnifiedCacheService.instance;
  }

  public getLiveData(manufacturer: string): CachedAircraftData[] {
    const key = this.normalizeKey(manufacturer);
    const entry = this.cache.get(key);

    if (!entry) {
      return [];
    }

    if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
      this.cache.delete(key);
      return [];
    }

    return entry.data;
  }

  public setLiveData(manufacturer: string, data: CachedAircraftData[]): void {
    const key = this.normalizeKey(manufacturer);
    const entry = this.cache.get(key) || {
      data: [],
      timestamp: Date.now(),
      subscriptions: new Set(),
    };

    entry.data = data;
    entry.timestamp = Date.now();
    this.cache.set(key, entry);

    entry.subscriptions.forEach((callback) => callback(data));
  }

  // ✅ New Method (if needed)
  public setAircraft(manufacturer: string, data: CachedAircraftData[]): void {
    this.setLiveData(manufacturer, data);
  }

  public subscribe(
    manufacturer: string,
    callback: (data: CachedAircraftData[]) => void
  ): () => void {
    const key = this.normalizeKey(manufacturer);
    const entry = this.cache.get(key) || {
      data: [],
      timestamp: Date.now(),
      subscriptions: new Set(),
    };

    entry.subscriptions.add(callback);
    this.cache.set(key, entry);

    return () => {
      const currentEntry = this.cache.get(key);
      if (currentEntry) {
        currentEntry.subscriptions.delete(callback);
      }
    };
  }

  public clearCache(manufacturer?: string): void {
    if (manufacturer) {
      const key = this.normalizeKey(manufacturer);
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  private normalizeKey(key: string): string {
    return key.trim().toUpperCase();
  }
}

export default UnifiedCacheService;
