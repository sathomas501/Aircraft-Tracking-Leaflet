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

interface AuthOptions {
    useEnvCredentials?: boolean;
    username?: string;
    password?: string;
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
    private authPromise: Promise<boolean> | null = null;
    private readonly AUTH_TIMEOUT = 15000; // 15 seconds
    private readonly MAX_RETRIES = 3;
    private readonly BASE_DELAY = 5000;

    // Endpoints for minimal requests
    private readonly AUTH_ENDPOINTS = [
        'https://opensky-network.org/api/states/all?time=0&icao24=a00001',
        'https://opensky-network.org/api/flights/all?begin=0&end=1',
    ];

    private constructor() {
        const username = process.env.NEXT_PUBLIC_OPENSKY_USERNAME;
        const password = process.env.NEXT_PUBLIC_OPENSKY_PASSWORD;

        if (username && password) {
            this.updateCredentials(username, password);
        } else {
            console.warn('[OpenSkyAuth] Missing environment credentials for OpenSky authentication.');
        }
    }

    static getInstance(): OpenSkyAuth {
        if (!OpenSkyAuth.instance) {
            OpenSkyAuth.instance = new OpenSkyAuth();
        }
        return OpenSkyAuth.instance;
    }

    private updateCredentials(username: string, password: string): void {
        this.state.credentials = { username, password };
        this.state.username = username;
    }

    /**
     * Ensures the user is authenticated before starting polling.
     */
    public async ensureAuthenticated(): Promise<boolean> {
        if (this.isAuthenticated()) {
            return true; // Already authenticated
        }
    
        console.log('[OpenSkyAuth] Authenticating...');
        const result = await this.authenticate({ useEnvCredentials: true });
        return result; // Return true or false based on authentication success
    }
    

    private handleError(type: ErrorType, message: string): never {
        const error = new Error(message);
        errorHandler.handleError(type, error);
        throw error;
    }


    public async authenticate(options: AuthOptions | string, password?: string): Promise<boolean> {
        if (this.authPromise) {
            return this.authPromise;
        }

        this.authPromise = (async () => {
            if (typeof options === 'string') {
                if (!password) {
                    this.handleError(ErrorType.AUTH, 'Password is required when passing username directly.');
                }
                this.updateCredentials(options, password!);
            } else if (options.useEnvCredentials) {
                const username = process.env.NEXT_PUBLIC_OPENSKY_USERNAME;
                const password = process.env.NEXT_PUBLIC_OPENSKY_PASSWORD;
                if (!username || !password) {
                    console.error('[OpenSkyAuth] Missing environment credentials.');
                    return false;
                }
                this.updateCredentials(username, password);
            } else if (options.username && options.password) {
                this.updateCredentials(options.username, options.password);
            } else {
                console.error('[OpenSkyAuth] Invalid authentication options provided.');
                return false;
            }

            const result = await this.performAuthentication();
            this.authPromise = null;
            return result;
        })();

        return this.authPromise;
    }

    /**
     * Handles authentication errors during polling by resetting the state and re-authenticating.
     */
    public async handleAuthError(): Promise<void> {
        console.warn('[OpenSkyAuth] Re-authenticating due to authentication failure.');
        this.reset();
        await this.authenticate({ useEnvCredentials: true });
    }

    private async performAuthentication(retryCount = 0): Promise<boolean> {
        const endpoint = this.AUTH_ENDPOINTS[retryCount % this.AUTH_ENDPOINTS.length];
        const authString = Buffer.from(`${this.state.credentials!.username}:${this.state.credentials!.password}`).toString('base64');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.AUTH_TIMEOUT);

            const response = await fetch(endpoint, {
                headers: {
                    Authorization: `Basic ${authString}`,
                    Accept: 'application/json',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                this.state.authenticated = true;
                this.state.lastAttempt = Date.now();
                return true;
            }

            if (response.status === 401 || response.status === 403) {
                this.handleError(ErrorType.AUTH, 'Invalid OpenSky credentials.');
            }

            if (retryCount < this.MAX_RETRIES - 1) {
                const delay = this.BASE_DELAY * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.performAuthentication(retryCount + 1);
            }

            return false;
        } catch (error) {
            if (retryCount < this.MAX_RETRIES - 1) {
                const delay = this.BASE_DELAY * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.performAuthentication(retryCount + 1);
            }
            errorHandler.handleError(ErrorType.AUTH, error instanceof Error ? error : new Error('Authentication failed'));
            return false;
        }
    }


    public getAuthHeaders(): Record<string, string> {
        if (!this.state.authenticated) {
            this.handleError(ErrorType.AUTH_REQUIRED, 'User not authenticated.');
        }
        return {
            Authorization: `Basic ${Buffer.from(
                `${this.state.credentials!.username}:${this.state.credentials!.password}`
            ).toString('base64')}`,
        };
    }

    public isAuthenticated(): boolean {
        return this.state.authenticated;
    }

    public reset(): void {
        console.log('[OpenSkyAuth] Resetting authentication state.');
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
