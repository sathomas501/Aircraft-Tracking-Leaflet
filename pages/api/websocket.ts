import WebSocket from 'ws';
import type { WebSocketClient } from '@/types/websocket';

export class EnhancedWebSocket extends WebSocket implements WebSocketClient {
    isAlive: boolean = true;
    
    constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        
        // Set up ping/pong handling
        this.on('pong', () => {
            this.isAlive = true;
        });

        this.on('close', () => {
            this.isAlive = false;
        });

        this.on('error', () => {
            this.isAlive = false;
        });
    }

    // Method to check connection status
    checkAlive(): boolean {
        if (this.readyState === WebSocket.OPEN) {
            return this.isAlive;
        }
        return false;
    }

    // Method to ping the connection
    ping(): void {
        if (this.readyState === WebSocket.OPEN) {
            this.isAlive = false;  // Will be set to true when pong is received
            super.ping();
        }
    }
}