// lib/services/opensky-integrated/ws-handler.ts
import type { WebSocketClient } from './types';
import type { Aircraft } from '@/types/base';
import { enhancedCache } from '../enhanced-cache';
import { errorHandler, ErrorType } from '../error-handler';

export class WebSocketHandler {
    private clients: Set<WebSocketClient> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private readonly PING_INTERVAL = 30000;

    constructor() {
        this.startPingInterval();
    }

    private startPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            this.clients.forEach((client) => {
                if (client.isAlive === false) {
                    client.terminate();
                    this.clients.delete(client);
                    return;
                }

                client.isAlive = false;
                client.ping();
            });
        }, this.PING_INTERVAL);
    }

    addClient(ws: WebSocketClient) {
        ws.isAlive = true;
        this.clients.add(ws);

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', (message: string) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'filter' && Array.isArray(data.icao24s)) {
                    ws.aircraftFilter = data.icao24s;
                }
            } catch (error) {
                errorHandler.handleError(ErrorType.DATA, 'Invalid WebSocket message format');
            }
        });
    }

    removeClient(ws: WebSocketClient) {
        this.clients.delete(ws);
        ws.terminate();
    }

    broadcast(data: Aircraft[]) {
        this.clients.forEach((client) => {
            if (client.readyState !== client.OPEN) return;

            try {
                const filteredData = client.aircraftFilter
                    ? data.filter(aircraft => client.aircraftFilter?.includes(aircraft.icao24))
                    : data;

                client.send(JSON.stringify(filteredData));
            } catch (error) {
                console.error('Error sending to client:', error);
                this.removeClient(client);
            }
        });
    }

    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.clients.forEach(client => client.terminate());
        this.clients.clear();
    }

    getClientCount(): number {
        return this.clients.size;
    }
}