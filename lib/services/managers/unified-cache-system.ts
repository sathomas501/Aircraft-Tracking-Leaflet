// lib/services/managers/unified-cache-system.ts
import { CachedAircraftData, Aircraft } from '@/types/base';
import { CacheTransforms } from '@/utils/aircraft-transform1';

export type UnsubscribeFunction = () => void;

interface CacheEntry {
  data: CachedAircraftData[];
  timestamp: number;
  subscriptions: Set<(data: CachedAircraftData[]) => void>;
}

class UnifiedCacheService {
  private static instance: UnifiedCacheService;
  private cache: Map<string, CacheEntry>;
  private staticCache: Map<string, CachedAircraftData>;
  private cleanupInterval: NodeJS.Timeout | null;
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly STATIC_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.cache = new Map();
    this.staticCache = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      // Clean live data cache
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.CACHE_EXPIRY) {
          this.cache.delete(key);
        }
      }

      // Clean static data cache
      for (const [key, data] of this.staticCache.entries()) {
        if (now - data.lastUpdated > this.STATIC_CACHE_EXPIRY) {
          this.staticCache.delete(key);
        }
      }
    }, 60000); // Run cleanup every minute
  }

  public static getInstance(): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService();
    }
    return UnifiedCacheService.instance;
  }

  public getLiveData(manufacturer: string): Aircraft[] {
    const key = this.normalizeKey(manufacturer);
    const entry = this.cache.get(key);

    if (!entry || Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
      if (entry) this.cache.delete(key);
      return [];
    }

    return entry.data.map(CacheTransforms.fromCache);
  }

  public getLiveDataRaw(manufacturer: string): CachedAircraftData[] {
    const key = this.normalizeKey(manufacturer);
    const entry = this.cache.get(key);

    if (!entry || Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
      if (entry) this.cache.delete(key);
      return [];
    }

    return entry.data;
  }

  public setLiveData(manufacturer: string, aircraft: Aircraft[]): void {
    const key = this.normalizeKey(manufacturer);
    const cachedData = aircraft.map(CacheTransforms.toCache);

    const entry = this.cache.get(key) || {
      data: [],
      timestamp: Date.now(),
      subscriptions: new Set(),
    };

    entry.data = cachedData;
    entry.timestamp = Date.now();
    this.cache.set(key, entry);

    entry.subscriptions.forEach((callback) => callback(cachedData));
  }

  public setStaticData(aircraft: Aircraft[]): void {
    aircraft.forEach((a) => {
      const cachedData = CacheTransforms.toCache(a);
      this.staticCache.set(a.icao24, cachedData);
    });
  }

  public getStaticData(icao24: string): Aircraft | undefined {
    const data = this.staticCache.get(icao24);
    if (!data || Date.now() - data.lastUpdated > this.STATIC_CACHE_EXPIRY) {
      if (data) this.staticCache.delete(icao24);
      return undefined;
    }
    return CacheTransforms.fromCache(data);
  }

  public getAllStaticData(): Aircraft[] {
    const now = Date.now();
    const validData: Aircraft[] = [];

    for (const [key, data] of this.staticCache.entries()) {
      if (now - data.lastUpdated <= this.STATIC_CACHE_EXPIRY) {
        validData.push(CacheTransforms.fromCache(data));
      } else {
        this.staticCache.delete(key);
      }
    }

    return validData;
  }

  public subscribe(
    manufacturer: string,
    callback: (data: Aircraft[]) => void
  ): UnsubscribeFunction {
    const key = this.normalizeKey(manufacturer);
    const entry = this.cache.get(key) || {
      data: [],
      timestamp: Date.now(),
      subscriptions: new Set(),
    };

    const wrappedCallback = (data: CachedAircraftData[]) => {
      callback(data.map(CacheTransforms.fromCache));
    };

    entry.subscriptions.add(wrappedCallback);
    this.cache.set(key, entry);

    if (entry.data.length > 0) {
      wrappedCallback(entry.data);
    }

    return () => {
      const currentEntry = this.cache.get(key);
      if (currentEntry) {
        currentEntry.subscriptions.delete(wrappedCallback);
        if (
          currentEntry.subscriptions.size === 0 &&
          currentEntry.data.length === 0
        ) {
          this.cache.delete(key);
        }
      }
    };
  }

  public clearCache(manufacturer?: string): void {
    if (manufacturer) {
      const key = this.normalizeKey(manufacturer);
      this.cache.delete(key);
    } else {
      this.cache.clear();
      this.staticCache.clear();
    }
  }

  private normalizeKey(key: string): string {
    return key.trim().toUpperCase();
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.staticCache.clear();
  }
}

export default UnifiedCacheService;
