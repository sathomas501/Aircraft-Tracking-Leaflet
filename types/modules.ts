// Ensure this is the only `declare module` for '@/lib/services/enhanced-cache'
declare module '@/lib/services/enhanced-cache' {
  export const enhancedCache: {
    get(ICAO24: string): Promise<import('@/types/base').Aircraft | null>;
    set(ICAO24: string, data: import('@/types/base').Aircraft): void;
    getAllAircraft(): import('@/types/base').Aircraft[];
  };
}
