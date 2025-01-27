// types/module.d.ts
declare module '@/lib/utils/position-interpolation' {
    export * from '@/lib/services/position-interpolator';
}

declare module '@/lib/services/aircraft-cache' {
    export * from '@/lib/services/enhanced-cache';
}

declare module '@/lib/services/opensky-auth' {
    export const openSkyAuth: {
        authenticate(): Promise<boolean>;
        getAuthHeaders(): Record<string, string>;
        isAuthenticated(): boolean;
        getUsername(): string | null;
    };
}

