import type { WebSocketClient, WebSocketMessage } from '@/types/websocket';
import type { IOpenSkyService } from '@/types/opensky/index';
import type { Aircraft } from '@/types/base';
import { unifiedCache } from '../managers/unified-cache-system'; 
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { getDatabase, allQuery, runQuery } from '@/lib/db/databaseManager';
import { AircraftMessage } from '@/types/opensky';

interface IcaoRow {
    icao24: string;
}

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
                const cachedData = await unifiedCache.getLatestData(); // Await the promise
                if (cachedData && cachedData.aircraft.length > 0) {
                    const aircraftData: Aircraft[] = cachedData.aircraft.map((plane) => ({
                        icao24: plane.icao24 || 'unknown',
                        latitude: plane.latitude ?? 0,
                        longitude: plane.longitude ?? 0,
                        altitude: plane.altitude ?? 0,
                        velocity: plane.velocity ?? 0,
                        heading: plane.heading ?? 0,
                        on_ground: plane.onGround ?? false,
                        last_contact: plane.lastContact ?? Date.now(),
                        "N-NUMBER": plane["N-NUMBER"] || 'N/A',
                        NAME: plane.NAME || 'Unknown',
                        CITY: plane.CITY || 'Unknown',
                        STATE: plane.STATE || 'Unknown',
                        TYPE_AIRCRAFT: plane.TYPE_AIRCRAFT || 'Unknown',
                        manufacturer: plane.manufacturer || 'Unknown',
                        OWNER_TYPE: plane.OWNER_TYPE || 'Unknown',
                        isTracked: plane.isTracked ?? false,
                    }));
                    await this.updateDatabaseWithPositions(aircraftData); // Pass the aircraft array
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
            const updatePromises = aircraft.map((plane) =>
                runQuery<void>(
                    `UPDATE aircraft SET 
                        latitude = ?, 
                        longitude = ?, 
                        altitude = ?,
                        velocity = ?,
                        heading = ?,
                        on_ground = ?
                    WHERE icao24 = ?`,
                    [
                        plane.latitude,
                        plane.longitude,
                        plane.altitude,
                        plane.velocity,
                        plane.heading,
                        plane.on_ground,
                        plane.icao24
                    ]
                )
            );
    
            await Promise.all(updatePromises);
        } catch (error) {
            errorHandler.handleError(
                ErrorType.DATA,
                'Failed to update aircraft positions in database',
                error instanceof Error ? error : new Error('Unknown error')
            );
        }
    }

    public async setCurrentManufacturer(manufacturer: string | null): Promise<void> {
        try {
            console.log('[DEBUG] Setting current manufacturer:', manufacturer);
    
            if (this.currentManufacturer && this.currentManufacturer !== manufacturer) {
                console.log('[DEBUG] Clearing active status for:', this.currentManufacturer);
                await runQuery<void>(
                    'UPDATE aircraft SET active = 0 WHERE manufacturer = ?',
                    [this.currentManufacturer]
                );
            }
    
            this.currentManufacturer = manufacturer;
    
            if (manufacturer) {
                const db = await getDatabase();
                const icao24s = await allQuery<IcaoRow>(
                    'SELECT icao24 FROM aircraft WHERE manufacturer = ?',
                    [manufacturer]
                );
    
                console.log('[DEBUG] Retrieved ICAO24 list for manufacturer:', icao24s);
    
                this.clients.forEach((client) => {
                    client.aircraftFilter = icao24s.map((row: IcaoRow) => row.icao24);
                });
            }
        } catch (error: unknown) {
            console.error('[DEBUG] Error setting manufacturer:', error);
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

    public broadcast(data: Partial<Aircraft>[]): void {
        const transformedData: Aircraft[] = data.map((aircraft) => ({
            icao24: aircraft.icao24 || 'unknown',
            latitude: aircraft.latitude ?? 0,
            longitude: aircraft.longitude ?? 0,
            altitude: aircraft.altitude ?? 0,
            velocity: aircraft.velocity ?? 0,
            heading: aircraft.heading ?? 0,
            on_ground: aircraft.on_ground ?? false,
            last_contact: aircraft.last_contact ?? Date.now(),
            "N-NUMBER": aircraft["N-NUMBER"] || 'N/A',
            NAME: aircraft.NAME || 'Unknown',
            CITY: aircraft.CITY || 'Unknown',
            STATE: aircraft.STATE || 'Unknown',
            TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || 'Unknown',
            manufacturer: aircraft.manufacturer || 'Unknown',
            OWNER_TYPE: aircraft.OWNER_TYPE || 'Unknown', // Default value for OWNER_TYPE
            isTracked: aircraft.isTracked ?? false, // Default value for isTracked
        }));
    
        // Send data to clients
        this.clients.forEach((client) => {
            if (client.readyState !== client.OPEN) return;
    
            try {
                const filteredData = client.aircraftFilter
                    ? transformedData.filter((aircraft) =>
                          client.aircraftFilter?.includes(aircraft.icao24)
                      )
                    : transformedData;
    
                const message: WebSocketMessage = {
                    type: 'positions',
                    data: filteredData,
                    manufacturer: this.currentManufacturer,
                };
    
                client.send(JSON.stringify(message));
            } catch (error: unknown) {
                console.error('Error sending to client:', error);
                this.removeClient(client);
                errorHandler.handleError(
                    ErrorType.WEBSOCKET,
                    'Failed to send data to client',
                    error instanceof Error ? error : new Error('Unknown error')
                );
            }
        });
    
        // Update the cache
        unifiedCache.update(transformedData);
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
            runQuery<void>(
                'UPDATE aircraft SET active = 0 WHERE manufacturer = ?',
                [this.currentManufacturer]
            ).catch((error: unknown) => {
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