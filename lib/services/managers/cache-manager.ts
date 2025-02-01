import NodeCache from 'node-cache';

export class CacheManager<T> {
    private cache: NodeCache;

    constructor(ttlSeconds: number) {
        this.cache = new NodeCache({ stdTTL: ttlSeconds });
    }

    get(key: string): T | undefined {
        return this.cache.get<T>(key);
    }

    set(key: string, value: T): void {
        this.cache.set(key, value);
    }

    flush(): void {
        this.cache.flushAll();
    }

    delete(key: string): void {
        this.cache.del(key);
    }

    /**
     * Get multiple items from the cache.
     * @param keys - Array of keys to retrieve.
     * @returns An object containing key-value pairs of found entries.
     */
    public getMultiple(keys: string[]): Record<string, T> {
        return this.cache.mget<T>(keys);
    }

    /**
     * Set multiple items in the cache.
     * @param entries - Object containing key-value pairs to store.
     */
    public setMultiple(entries: Record<string, T>): void {
        this.cache.mset(Object.entries(entries).map(([key, value]) => ({ key, val: value })));
    }

    public invalidate(predicate: (key: string) => boolean): void {
        const keys = this.cache.keys();
        keys.forEach(key => {
            if (predicate(key)) {
                this.cache.del(key);
            }
        });
    }

    public size(): number {
        return this.cache.keys().length;
    }
}

export default CacheManager;
