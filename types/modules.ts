// Ensure this is the only `declare module` for '@/lib/services/enhanced-cache'
declare module '@/lib/services/enhanced-cache' {
    export const enhancedCache: {
        get(icao24: string): Promise<import('@/types/base').Aircraft | null>;
        set(icao24: string, data: import('@/types/base').Aircraft): void;
        getAllAircraft(): import('@/types/base').Aircraft[];
    };
}
