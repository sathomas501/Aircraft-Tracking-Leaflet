import NodeCache from 'node-cache';

export class CacheManager<T> {
    private cache: NodeCache;

    /**
     * Constructor to initialize the cache with a specified TTL (Time-to-Live) in seconds.
     * @param ttlSeconds - The time-to-live for cached entries in seconds.
     */
    constructor(ttlSeconds: number) {
        this.cache = new NodeCache({ stdTTL: ttlSeconds });
    }

    /**
     * Get an item from the cache.
     * @param key - The key to retrieve from the cache.
     * @returns The cached value, or undefined if not found.
     */
    get(key: string): T | undefined {
        return this.cache.get<T>(key);
    }

    /**
     * Set an item in the cache.
     * @param key - The key to store the value under.
     * @param value - The value to cache.
     */
    set(key: string, value: T): void {
        this.cache.set(key, value);
    }

    /**
     * Flush all cached entries.
     */
    flush(): void {
        this.cache.flushAll();
    }

    /**
     * Delete a specific key from the cache.
     * @param key - The key to delete.
     */
    delete(key: string): void {
        this.cache.del(key);
    }
}

export default CacheManager;
