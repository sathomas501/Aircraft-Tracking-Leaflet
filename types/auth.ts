// types/auth.ts
export type AuthStatusType = 'idle' | 'authenticating' | 'authenticated' | 'failed';
export type TrackingStatusType = 'idle' | 'loading' | 'complete' | 'error';

export interface AuthState {
    status: AuthStatusType;
    lastAttempt: number;
    error: string | null;
}

export interface MapWrapperProps {
    initialAuthStatus: AuthStatusType;
}