// types/module.d.ts
declare module '@/lib/utils/position-interpolation' {
    export * from '@/lib/services/position-interpolator';
}

declare module '@/lib/services/aircraft-cache' {
    export * from '@/lib/services/enhanced-cache';
}

declare interface OpenSkyAuthInterface {
    authenticate(options?: AuthOptions | string, password?: string): Promise<boolean>;
    getAuthHeaders(): Record<string, string>;
    isAuthenticated(): boolean;
    getUsername(): string | null;
    handleAuthError(): Promise<void>;
    ensureAuthenticated(): Promise<boolean>;
    reset(): void;
}

declare interface AuthOptions {
    useEnvCredentials?: boolean;
    username?: string;
    password?: string;
}

