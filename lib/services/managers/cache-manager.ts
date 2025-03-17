import NodeCache from 'node-cache';

export class CacheManager<T> {
  private cache: NodeCache;

  constructor(ttlSeconds: number) {
    this.cache = new NodeCache({ stdTTL: ttlSeconds });
  }

  get(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  public getMultiple(keys: string[]): Record<string, T> {
    return this.cache.mget<T>(keys);
  }

  public setMultiple(entries: Record<string, T>): void {
    this.cache.mset(
      Object.entries(entries).map(([key, value]) => ({ key, val: value }))
    );
  }

  set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  delete(key: string): void {
    this.cache.del(key);
  }

  public size(): number {
    return this.cache.keys().length;
  }
}

// ✅ Keep this only for general caching needs
export const cacheManager = new CacheManager<any>(60);
