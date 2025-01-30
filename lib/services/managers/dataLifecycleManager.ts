import { CacheManager } from '@/lib/services/managers/cache-manager';

export class DataLifecycleManager {
    private static instance: DataLifecycleManager;
    private cacheManager: CacheManager<any>;

    private constructor() {
        this.cacheManager = new CacheManager(60); // Example TTL of 60 seconds
    }

    public static getInstance(): DataLifecycleManager {
        if (!DataLifecycleManager.instance) {
            DataLifecycleManager.instance = new DataLifecycleManager();
        }
        return DataLifecycleManager.instance;
    }

    public getCachedValue(key: string): any {
        return this.cacheManager.get(key); // Use the cacheManager's get method
    }

    public setCachedValue(key: string, value: any): void {
        this.cacheManager.set(key, value); // Use the cacheManager's set method
    }

    public clearCache(predicate: (key: string) => boolean): void {
        this.cacheManager.invalidate(predicate); // Use invalidate for conditional removal
    }

    public getCacheStats(): { size: number } {
        return {
            size: this.cacheManager.size(), // Get the size of the cache
        };
    }
}
