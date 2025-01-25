class UnifiedCacheService {
    private static instance: UnifiedCacheService;
    private dataCache: Map<string, any> = new Map();

    private constructor() {}

    static getInstance(): UnifiedCacheService {
        if (!UnifiedCacheService.instance) {
            UnifiedCacheService.instance = new UnifiedCacheService();
        }
        return UnifiedCacheService.instance;
    }

    // Add getLatestData
    getLatestData(): any[] {
        console.log('[UnifiedCache] Returning latest cached data');
        return Array.from(this.dataCache.values());
    }

    // Add update
    update(key: string, value: any): void {
        console.log(`[UnifiedCache] Updating cache for key: ${key}`);
        this.dataCache.set(key, value);
    }
}

export const unifiedCache = UnifiedCacheService.getInstance();
