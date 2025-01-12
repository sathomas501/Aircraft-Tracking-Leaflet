// lib/services/websocket-auth.ts
interface AuthConfig {
    username: string;
    password: string;
}

class WebSocketAuthService {
    private static instance: WebSocketAuthService;
    private authConfig: AuthConfig | null = null;
    private authToken: string | null = null;
    private authExpiry: number = 0;
    private readonly AUTH_TTL = 24 * 60 * 60 * 1000; // 24 hours

    private constructor() {
        // Try to load auth from localStorage on init
        if (typeof window !== 'undefined') {
            try {
                const savedAuth = localStorage.getItem('opensky_auth');
                if (savedAuth) {
                    const { config, token, expiry } = JSON.parse(savedAuth);
                    if (Date.now() < expiry) {
                        this.authConfig = config;
                        this.authToken = token;
                        this.authExpiry = expiry;
                    }
                }
            } catch (error) {
                console.error('Error loading auth:', error);
            }
        }
    }

    static getInstance(): WebSocketAuthService {
        if (!WebSocketAuthService.instance) {
            WebSocketAuthService.instance = new WebSocketAuthService();
        }
        return WebSocketAuthService.instance;
    }

    async authenticate(config: AuthConfig): Promise<boolean> {
        try {
            // Test authentication with OpenSky
            const response = await fetch('https://opensky-network.org/api/states/all', {
                headers: {
                    'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`)
                }
            });

            if (response.ok) {
                this.authConfig = config;
                this.authToken = btoa(`${config.username}:${config.password}`);
                this.authExpiry = Date.now() + this.AUTH_TTL;

                // Save to localStorage
                if (typeof window !== 'undefined') {
                    localStorage.setItem('opensky_auth', JSON.stringify({
                        config: this.authConfig,
                        token: this.authToken,
                        expiry: this.authExpiry
                    }));
                }

                return true;
            }
            return false;
        } catch (error) {
            console.error('Authentication error:', error);
            return false;
        }
    }

    getAuthHeaders(): Record<string, string> {
        if (this.authToken && Date.now() < this.authExpiry) {
            return {
                'Authorization': `Basic ${this.authToken}`
            };
        }
        return {};
    }

    getWebSocketUrl(): string {
        if (!this.authConfig || Date.now() >= this.authExpiry) {
            return 'wss://opensky-network.org/api/websocket';
        }

        const { username, password } = this.authConfig;
        return `wss://opensky-network.org/api/websocket/auth?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    }

    isAuthenticated(): boolean {
        return !!this.authToken && Date.now() < this.authExpiry;
    }

    clearAuth() {
        this.authConfig = null;
        this.authToken = null;
        this.authExpiry = 0;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('opensky_auth');
        }
    }
}

export const wsAuth = WebSocketAuthService.getInstance();