<<<<<<< HEAD
// types/module.ts

=======
// types/module.d.ts
declare module '@/lib/utils/position-interpolation' {
    export * from '@/lib/services/position-interpolator';
}
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6

declare module '@/lib/services/aircraft-cache' {
    export * from '@/lib/services/enhanced-cache';
}

<<<<<<< HEAD
=======
declare module '@/lib/services/opensky-auth' {
    export const openSkyAuth: {
        authenticate(): Promise<boolean>;
        getAuthHeaders(): Record<string, string>;
        isAuthenticated(): boolean;
        getUsername(): string | null;
    };
}
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6

declare module '@/lib/services/enhanced-cache' {
    export const enhancedCache: {
        get(icao24: string): Promise<import('@/types/base').Aircraft | null>;
        set(icao24: string, data: import('@/types/base').Aircraft): void;
        getAllAircraft(): import('@/types/base').Aircraft[];
    };
}