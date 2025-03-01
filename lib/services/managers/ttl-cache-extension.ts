// lib/services/ttl-cache-extension.ts
import { enhancedCache } from './enhanced-cache';
import type { Aircraft } from '@/types/base';

/**
 * Extension of enhancedCache with TTL and generic caching support
 */
class TTLCacheExtension {
  private static instance: TTLCacheExtension;
  private ttlCache: Map<string, { data: any; expiry: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  static getInstance(): TTLCacheExtension {
    if (!TTLCacheExtension.instance) {
      TTLCacheExtension.instance = new TTLCacheExtension();
    }
    return TTLCacheExtension.instance;
  }

  /**
   * Get data from TTL cache
   */
  async getWithTTL<T>(key: string): Promise<T | null> {
    const entry = this.ttlCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.ttlCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in TTL cache
   */
  async setWithTTL<T>(
    key: string,
    data: T,
    ttlSeconds: number = 300
  ): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.ttlCache.set(key, { data, expiry });
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.ttlCache.delete(key);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.ttlCache.clear();
    enhancedCache.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    this.ttlCache.forEach((entry, key) => {
      if (now > entry.expiry) {
        this.ttlCache.delete(key);
      }
    });
  }

  /**
   * Pass-through methods to enhancedCache
   */
  get(icao24: string): Promise<Aircraft | null> {
    return enhancedCache.get(icao24);
  }

  set(icao24: string, data: Aircraft): void {
    enhancedCache.set(icao24, data);
  }

  update(aircraft: Aircraft[]): void {
    enhancedCache.update(aircraft);
  }

  getLatestData(): Aircraft[] {
    return enhancedCache.getLatestData();
  }

  getAllAircraft(): Aircraft[] {
    return enhancedCache.getAllAircraft();
  }

  /**
   * Destroy instance
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.ttlCache.clear();
  }
}

export const ttlCacheExtension = TTLCacheExtension.getInstance();
