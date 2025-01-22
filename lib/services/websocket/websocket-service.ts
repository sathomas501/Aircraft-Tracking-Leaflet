// lib/services/websocket/websocket-service.ts
import WebSocket from 'ws';
import { openSkyAuth } from '../opensky-auth';
import { errorHandler, ErrorType } from '../error-handler';

export interface WebSocketConfig {
    url: string;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    authRequired?: boolean;
}

export type MessageHandler = (data: any) => void;
export type ErrorHandler = (error: Error) => void;
export type ConnectionHandler = () => void;

export class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private readonly config: Required<WebSocketConfig>;  // Initialize in constructor
    private messageHandler: MessageHandler | null = null;
    private errorHandler: ErrorHandler | null = null;
    private onConnectHandler: ConnectionHandler | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isConnected = false;

    constructor(config: WebSocketConfig) {
        // Initialize config with defaults
        this.config = {
            url: config.url,
            reconnectAttempts: config.reconnectAttempts ?? 3,
            reconnectDelay: config.reconnectDelay ?? 5000,
            authRequired: config.authRequired ?? true
        };
    }

    async connect(
        messageHandler: MessageHandler,
        errorHandler: ErrorHandler,
        onConnect?: ConnectionHandler
    ): Promise<void> {
        this.messageHandler = messageHandler;
        this.errorHandler = errorHandler;
        this.onConnectHandler = onConnect ?? null;

        await this.establishConnection();
    }

    private async establishConnection(): Promise<void> {
        try {
            let headers = {};
            
            if (this.config.authRequired) {
                console.log('[WebSocket] Authenticating...');
                const isAuthenticated = await openSkyAuth.authenticate({
                    useEnvCredentials: true
                });
            
                if (!isAuthenticated) {
                    throw new Error('Authentication failed');
                }
            
                headers = openSkyAuth.getWebSocketHeaders();
            }

            this.ws = new WebSocket(this.config.url, { headers });

            this.setupEventListeners();

        } catch (error) {
            console.error('[WebSocket] Connection error:', error);
            this.handleError(error as Error);
        }
    }

    private setupEventListeners(): void {
        if (!this.ws) return;

        this.ws.on('open', () => {
            console.log('[WebSocket] Connection established');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            if (this.onConnectHandler) {
                this.onConnectHandler();
            }
        });

        this.ws.on('message', (data) => {
            if (this.messageHandler) {
                try {
                    const parsedData = JSON.parse(data.toString());
                    this.messageHandler(parsedData);
                } catch (error) {
                    console.error('[WebSocket] Message parsing error:', error);
                    this.handleError(error as Error);
                }
            }
        });

        this.ws.on('error', (error) => {
            console.error('[WebSocket] Error:', error);
            this.handleError(error);
        });

        this.ws.on('close', (code, reason) => {
            console.log('[WebSocket] Connection closed:', { code, reason });
            this.isConnected = false;
            this.handleReconnect();
        });
    }

    private handleError(error: Error): void {
        if (this.errorHandler) {
            this.errorHandler(error);
        }

        if (error.message.includes('403')) {
            openSkyAuth.reset();
        }
    }

    private handleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        if (this.reconnectAttempts >= this.config.reconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached');
            errorHandler.handleError(
                ErrorType.WEBSOCKET,
                'Failed to establish connection after multiple attempts'
            );
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            30000
        );

        console.log(
            `[WebSocket] Attempting to reconnect (${this.reconnectAttempts}/${this.config.reconnectAttempts}) in ${delay}ms`
        );

        this.reconnectTimeout = setTimeout(() => {
            this.establishConnection();
        }, delay);
    }

    disconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
    }

    isActive(): boolean {
        return this.isConnected;
    }
}