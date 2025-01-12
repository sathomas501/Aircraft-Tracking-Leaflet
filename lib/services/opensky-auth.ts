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
        credentials: null
    };
    private authPromise: Promise<boolean> | null = null;

    private constructor() {
        // Initialize with environment variables
        this.updateCredentials(
            process.env.OPENSKY_USERNAME,
            process.env.OPENSKY_PASSWORD
        );
    }

    static getInstance(): OpenSkyAuth {
        if (!OpenSkyAuth.instance) {
            OpenSkyAuth.instance = new OpenSkyAuth();
        }
        return OpenSkyAuth.instance;
    }

    private updateCredentials(username?: string, password?: string) {
        if (username && password) {
            this.state.credentials = { username, password };
            this.state.username = username;
        }
    }

    async authenticate(): Promise<boolean> {
        // Return existing auth state if authenticated
        if (this.state.authenticated) {
            return true;
        }

        // Check if we're still in retry period
        const now = Date.now();
        if (now - this.state.lastAttempt < this.state.retryAfter) {
            const retryInSeconds = Math.ceil((this.state.retryAfter - (now - this.state.lastAttempt)) / 1000);
            errorHandler.handleError(ErrorType.RATE_LIMIT, `Authentication rate limited. Try again in ${retryInSeconds} seconds`, {
                retryAfter: retryInSeconds
            });
            return false;
        }

        // Use existing promise if authentication is in progress
        if (this.authPromise) {
            return this.authPromise;
        }

        this.authPromise = this.performAuthentication();

        try {
            const result = await this.authPromise;
            return result;
        } finally {
            this.authPromise = null;
        }
    }

    private async performAuthentication(): Promise<boolean> {
        if (!this.state.credentials) {
            errorHandler.handleError(ErrorType.AUTH, 'OpenSky credentials not provided');
            return false;
        }

        try {
            console.log(`Authenticating with OpenSky for user ${this.state.credentials.username}`);
            
            const response = await fetch('https://opensky-network.org/api/user', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    const error = new Error('Invalid OpenSky credentials');
                    errorHandler.handleError(ErrorType.AUTH, error);
                    return false;
                }
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('retry-after') || '300', 10);
                    this.state.retryAfter = retryAfter * 1000;
                    errorHandler.handleError(ErrorType.RATE_LIMIT, `Rate limited. Try again in ${retryAfter} seconds`, {
                        retryAfter
                    });
                    return false;
                }
                throw new Error(`Authentication failed: ${response.statusText}`);
            }

            this.state.authenticated = true;
            this.state.lastAttempt = Date.now();
            this.state.retryAfter = 0;

            return true;

        } catch (error) {
            this.state.authenticated = false;
            this.state.lastAttempt = Date.now();
            
            if (error instanceof Error) {
                errorHandler.handleError(ErrorType.AUTH, error);
            }

            return false;
        }
    }

    getAuthHeaders(): Record<string, string> {
        if (!this.state.credentials) {
            return {};
        }

        return {
            'Authorization': 'Basic ' + Buffer.from(
                `${this.state.credentials.username}:${this.state.credentials.password}`
            ).toString('base64')
        };
    }

    isAuthenticated(): boolean {
        return this.state.authenticated;
    }

    getUsername(): string | null {
        return this.state.username;
    }

    reset() {
        this.state = {
            authenticated: false,
            lastAttempt: 0,
            retryAfter: 0,
            username: null,
            credentials: null
        };
        this.authPromise = null;
    }
}

export const openSkyAuth = OpenSkyAuth.getInstance();