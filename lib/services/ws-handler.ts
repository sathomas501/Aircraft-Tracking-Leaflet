import type { WebSocketClient, WebSocketMessage } from '@/types/websocket';
import type { IOpenSkyService } from '@/types/opensky/index';
import type { Aircraft } from '@/types/base';
import { enhancedCache } from '../services/managers/enhanced-cache';
import { errorHandler, ErrorType } from './error-handler';
import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';
import { AircraftStatus } from '@/types/database';




export class WebSocketHandler {
    private clients: Set<WebSocketClient> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private readonly PING_INTERVAL = 30000;
    private readonly UPDATE_DB_INTERVAL = 30000;
    private currentManufacturer: string | null = null;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;

    constructor(private service: IOpenSkyService) {
        this.startPingInterval();
        this.startUpdateInterval();
    }

    public connect(client: WebSocketClient, url: string): void {
        if (this.clients.has(client)) return;

        client.isAlive = true;
        client.on('pong', () => {
            client.isAlive = true;
        });

        this.clients.add(client);
        this.service.addClient(client);

        client.on('close', () => {
            this.removeClient(client);
        });

        client.on('message', (message: Buffer | string) => {
            try {
                const data: WebSocketMessage = JSON.parse(message.toString());
                if (data.type === 'filter' && Array.isArray(data.icao24s)) {
                    client.aircraftFilter = data.icao24s;
                }
            } catch (error) {
                errorHandler.handleError(
                    ErrorType.DATA,
                    'Invalid WebSocket message format',
                    error instanceof Error ? error : new Error('Unknown error')
                );
            }
        });

        if (!client.isAlive && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            setTimeout(
                () => this.connect(client, url),
                1000 * Math.pow(2, this.reconnectAttempts)
            );
            this.reconnectAttempts++;
        }
    }

    private startPingInterval(): void {
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

    private startUpdateInterval(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(async () => {
            try {
                const cachedData = enhancedCache.getLatestData();
                if (cachedData && cachedData.length > 0) {
                    await this.updateDatabaseWithPositions(cachedData);
                }
            } catch (error) {
                errorHandler.handleError(
                    ErrorType.DATA,
                    'Failed to update database with positions',
                    error instanceof Error ? error : new Error('Unknown error')
                );
            }
        }, this.UPDATE_DB_INTERVAL);
    }

    private async updateDatabaseWithPositions(aircraft: Aircraft[]): Promise<void> {
        try {
            const dbManager = TrackingDatabaseManager.getInstance();
            await Promise.all(
                aircraft.map((plane) =>
                    dbManager.upsertActiveAircraft(plane.icao24, {
                        latitude: plane.latitude,
                        longitude: plane.longitude,
                        altitude: plane.altitude,
                        velocity: plane.velocity,
                        heading: plane.heading,
                        on_ground: plane.on_ground,
                    })
                )
            );
        } catch (error: unknown) {
            console.error('Failed to update database with positions:', error);
        }
    }

    public async setCurrentManufacturer(manufacturer: string | null): Promise<void> {
        try {
            if (this.currentManufacturer && this.currentManufacturer !== manufacturer) {
                const dbManager = TrackingDatabaseManager.getInstance();
                await dbManager.clearActiveStatus(this.currentManufacturer);
            }

            this.currentManufacturer = manufacturer;

            if (manufacturer) {
                const db = TrackingDatabaseManager.getInstance();
const icao24s = await db.getAll<{ icao24: string }>(
    'SELECT icao24 FROM aircraft WHERE manufacturer = ?',
    [manufacturer]
);

                this.clients.forEach((client) => {
                    client.aircraftFilter = icao24s.map((row: { icao24: string }) => row.icao24);
                });
            }
        } catch (error: unknown) {
            errorHandler.handleError(
                ErrorType.DATA,
                'Failed to set current manufacturer',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    public addClient(client: WebSocketClient): void {
        this.clients.add(client);
    }

    public removeClient(client: WebSocketClient): void {
        this.clients.delete(client);
        this.service.removeClient(client);
        client.terminate();
    }

    public broadcast(data: Aircraft[]): void {
        this.clients.forEach((client) => {
            if (client.readyState !== client.OPEN) return;
    
            try {
                const filteredData = client.aircraftFilter
                    ? data
                          .map((aircraft) => ({
                              ...aircraft,
                              model: aircraft.model ?? 'Unknown', // Provide default model
                          }))
                          .filter((aircraft) => client.aircraftFilter?.includes(aircraft.icao24))
                    : data.map((aircraft) => ({
                          ...aircraft,
                          model: aircraft.model ?? 'Unknown', // Provide default model
                      }));
    
                const message: WebSocketMessage = {
                    type: 'positions',
                    data: filteredData,
                    manufacturer: this.currentManufacturer,
                };
    
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error sending to client:', error);
                this.removeClient(client);
                errorHandler.handleError(
                    ErrorType.WEBSOCKET,
                    'Failed to send data to client',
                    error instanceof Error ? error : new Error('Unknown error')
                );
            }
        });
    
        enhancedCache.update(data);
    }

    public cleanup(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.clients.forEach((client) => client.terminate());
        this.clients.clear();

        if (this.currentManufacturer) {
            const dbManager = TrackingDatabaseManager.getInstance();
dbManager.clearActiveStatus(this.currentManufacturer).catch((error: unknown) => {
                errorHandler.handleError(
                    ErrorType.DATA,
                    'Failed to clear active status during cleanup',
                    error instanceof Error ? error : new Error('Unknown error')
                );
            });
        }
    }

    public getClientCount(): number {
        return this.clients.size;
    }
}