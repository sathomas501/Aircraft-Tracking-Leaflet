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
        credentials: null
    };
    private authPromise: Promise<boolean> | null = null;

    private constructor() {
        console.log('[OpenSkyAuth] Constructor starting');
        // Initialize with environment variables
        const username = process.env.NEXT_PUBLIC_OPENSKY_USERNAME;
        const password = process.env.NEXT_PUBLIC_OPENSKY_PASSWORD;
        
        console.log('[OpenSkyAuth] Constructor - Environment variables:', {
            hasUsername: !!username,
            hasPassword: !!password,
            actualUsername: username  // Log actual username for debugging
        });

        this.updateCredentials(username, password);
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

    public async authenticate(options: AuthOptions | string, password?: string): Promise<boolean> {
        // Handle legacy case where username and password are passed separately
        if (typeof options === 'string') {
            if (!password) {
                throw new Error('Password is required when passing username directly');
            }
            this.state.credentials = { username: options, password };
            return await this.performAuthentication();
        }

        // Handle new options object approach
        if (options.useEnvCredentials) {
            const envUsername = process.env.NEXT_PUBLIC_OPENSKY_USERNAME;
            const envPassword = process.env.NEXT_PUBLIC_OPENSKY_PASSWORD;
            
            if (!envUsername || !envPassword) {
                console.error('[OpenSkyAuth] Environment credentials not found');
                return false;
            }
            
            this.state.credentials = { 
                username: envUsername, 
                password: envPassword 
            };
        } else if (options.username && options.password) {
            this.state.credentials = {
                username: options.username,
                password: options.password
            };
        } else {
            console.error('[OpenSkyAuth] Invalid authentication options provided');
            return false;
        }

        return await this.performAuthentication();
    }
    

    private async performAuthentication(retryCount = 0): Promise<boolean> {
        const maxRetries = 3;
        const baseDelay = 5000;
    
        if (!this.state.credentials) {
            console.error('[OpenSkyAuth] Missing credentials:', {
                hasUsername: false,
                hasPassword: false
            });
            errorHandler.handleError(ErrorType.AUTH, 'OpenSky credentials not provided');
            return false;
        }
    
        try {
            console.log('[OpenSkyAuth] Attempting authentication with:', {
                username: this.state.credentials.username,
                hasPassword: Boolean(this.state.credentials.password),
                retryCount
            });
    
            const headers = this.getAuthHeaders();
            const response = await fetch('https://opensky-network.org/api/states/all', {
                headers
            });
    
            console.log('[OpenSkyAuth] Response:', {
                status: response.status,
                statusText: response.statusText
            });
    
            if (response.ok) {
                this.state.authenticated = true;
                this.state.lastAttempt = Date.now();
                this.state.retryAfter = 0;
                return true;
            }
    
            if (response.status === 503 && retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                console.warn(`[OpenSkyAuth] Service unavailable. Retrying in ${delay / 1000} seconds...`);
                this.state.lastAttempt = Date.now();
                this.state.retryAfter = delay;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.performAuthentication(retryCount + 1);
            }
    
            const responseText = await response.text();
            throw new Error(`Authentication failed with status: ${response.status} - ${response.statusText}. Response: ${responseText}`);
        } catch (error) {
            console.error('[OpenSkyAuth] Authentication error:', {
                message: error instanceof Error ? error.message : String(error)
            });
            this.state.authenticated = false;
            this.state.lastAttempt = Date.now();
            return false;
        }
    }
    
    getAuthHeaders(): Record<string, string> {
        if (!this.state.authenticated) {
            throw errorHandler.create(ErrorType.AUTH_REQUIRED, 'User not authenticated.');
        }
        return {
            Authorization: `Basic ${Buffer.from(
                `${this.state.credentials!.username}:${this.state.credentials!.password}`
            ).toString('base64')}`,
        };
    }


    isAuthenticated(): boolean {
        return this.state.authenticated;
    }

    getUsername(): string | null {
        return this.state.username;
    }

    getWebSocketHeaders(): Record<string, string> {
        return this.getAuthHeaders(); // Reuse existing headers logic
    }

    reset(): void {
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