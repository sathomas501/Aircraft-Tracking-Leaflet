// lib/services/opensky-auth.ts
import { errorHandler, ErrorType } from './error-handler';

interface AuthCredentials {
    username: string;
    password: string;
}

interface AuthState {
    authenticated: boolean;
    lastAttempt: number;
    retryAfter: number;
    username: string | null;
    credentials: AuthCredentials | null;
}

export class OpenSkyAuth {
    private static instance: OpenSkyAuth;
    private state: AuthState = {
        authenticated: false,
        lastAttempt: 0,
        retryAfter: 0,
        username: null,
        credentials: null,
    };
    private readonly AUTH_TIMEOUT = 15000;
    private readonly MAX_RETRIES = 3;
    private readonly BASE_DELAY = 5000;

    private constructor() {
        // Load credentials immediately in constructor
        const username = process.env.OPENSKY_USERNAME;
        const password = process.env.OPENSKY_PASSWORD;

        console.log('[OpenSkyAuth] Environment check:', {
            usernamePresent: !!username,
            passwordPresent: !!password
        });

        if (username && password) {
            this.updateCredentials(username, password);
            console.log('[OpenSkyAuth] Credentials loaded from environment');
        } else {
            console.error('[OpenSkyAuth] Missing environment credentials!');
        }
    }

    public static getInstance(): OpenSkyAuth {
        if (!OpenSkyAuth.instance) {
            OpenSkyAuth.instance = new OpenSkyAuth();
        }
        return OpenSkyAuth.instance;
    }

    private updateCredentials(username: string, password: string): void {
        this.state.credentials = { username, password };
        this.state.username = username;
        console.log('[OpenSkyAuth] Credentials updated for user:', username);
    }

    public async ensureAuthenticated(): Promise<boolean> {
        console.log('[OpenSkyAuth] Starting authentication check');
        
        if (this.isAuthenticated()) {
            console.log('[OpenSkyAuth] Already authenticated');
            return true;
        }

        console.log('[OpenSkyAuth] Not authenticated, attempting authentication');
        if (!this.state.credentials) {
            console.error('[OpenSkyAuth] No credentials available for authentication');
            const username = process.env.OPENSKY_USERNAME;
            const password = process.env.OPENSKY_PASSWORD;
            
            if (username && password) {
                console.log('[OpenSkyAuth] Loading credentials from environment');
                this.updateCredentials(username, password);
            } else {
                console.error('[OpenSkyAuth] No environment credentials available');
                return false;
            }
        }

        return this.authenticate({ useEnvCredentials: true });
    }

    public getAuthHeaders(): Record<string, string> {
        if (!this.state.credentials) {
            console.error('[OpenSkyAuth] No credentials available for headers');
            throw new Error('Authentication required');
        }

        const authString = Buffer.from(
            `${this.state.credentials.username}:${this.state.credentials.password}`
        ).toString('base64');

        return {
            'Authorization': `Basic ${authString}`
        };
    }

    public async authenticate(options: { useEnvCredentials: boolean }): Promise<boolean> {
        console.log('[OpenSkyAuth] Starting authentication process');
        
        if (options.useEnvCredentials) {
            const username = process.env.OPENSKY_USERNAME;
            const password = process.env.OPENSKY_PASSWORD;
            
            if (!username || !password) {
                console.error('[OpenSkyAuth] Missing environment credentials during authentication');
                return false;
            }

            this.updateCredentials(username, password);
        }

        try {
            // Test authentication with a minimal request
            const authString = Buffer.from(
                `${this.state.credentials!.username}:${this.state.credentials!.password}`
            ).toString('base64');

            // Make a minimal request to verify auth
            const response = await fetch('https://opensky-network.org/api/states/all?time=0&icao24=a00001', {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Accept': 'application/json'
                }
            });

            console.log('[OpenSkyAuth] Auth test response status:', response.status);

            if (response.ok) {
                this.state.authenticated = true;
                this.state.lastAttempt = Date.now();
                console.log('[OpenSkyAuth] Authentication successful');
                return true;
            } else {
                console.error('[OpenSkyAuth] Authentication failed:', response.status);
                this.state.authenticated = false;
                return false;
            }
        } catch (error) {
            console.error('[OpenSkyAuth] Authentication error:', error);
            this.state.authenticated = false;
            return false;
        }
    }

    public isAuthenticated(): boolean {
        return this.state.authenticated;
    }

    public reset(): void {
        console.log('[OpenSkyAuth] Resetting authentication state');
        this.state = {
            authenticated: false,
            lastAttempt: 0,
            retryAfter: 0,
            username: null,
            credentials: null,
        };
    }
}

export const openSkyAuth = OpenSkyAuth.getInstance(); 