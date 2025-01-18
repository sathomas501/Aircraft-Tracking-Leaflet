// lib/managers/cache-manager.ts
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
}
