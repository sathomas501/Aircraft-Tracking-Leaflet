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

 /**
     * Invalidate cache entries based on a predicate function.
     * @param predicate - A function to test each key. Keys matching the predicate are deleted.
     */
 public invalidate(predicate: (key: string) => boolean): void {
    const keys = this.cache.keys(); // Get all keys in the cache
    keys.forEach(key => {
        if (predicate(key)) {
            this.cache.del(key); // Delete the key if the predicate matches
        }
    });
}

/**
 * Get the size of the cache (number of entries).
 * @returns The number of entries in the cache.
 */
public size(): number {
    return this.cache.keys().length; // NodeCache provides a method to get all keys
}
}

export default CacheManager;

