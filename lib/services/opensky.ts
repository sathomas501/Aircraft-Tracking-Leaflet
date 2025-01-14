// lib/services/opensky.ts
import axios from 'axios';
import WebSocket from 'ws';
import NodeCache from 'node-cache';
import type { Aircraft } from '@/types/base';
import { getDb } from '@/lib/db/connection';

import type { 
    OpenSkyResponse, 
    PositionData, 
    WebSocketMessage,
} from '@/types/api/opensky';

import {
    API_ENDPOINTS,
    API_PARAMS,
    WS_CONFIG,
} from '@/lib/api/constants';

export class OpenSkyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
      super(message);
      this.name = 'OpenSkyError';
  }
}

export type PositionUpdateCallback = (positions: PositionData[]) => Promise<void>;
export type WebSocketClient = WebSocket;
export interface ActiveCounts {
    active: number;
    total: number;
}

export interface OpenSkyServiceInterface {
  getPositions(icao24s?: string[]): Promise<PositionData[]>;
  getActiveCount(manufacturer: string, model?: string): Promise<ActiveCounts>;
  clearActiveCache(manufacturer?: string, model?: string): void;
  cleanup(): void;
  onPositionUpdate(callback: PositionUpdateCallback): void;
  removePositionUpdateCallback(callback: PositionUpdateCallback): void;
  subscribeToAircraft(icao24s: string[]): Promise<void>;
  unsubscribeFromAircraft(icao24s: string[]): void;
  addClient(client: WebSocketClient): void;
  removeClient(client: WebSocketClient): void;
}

class OpenSkyService implements OpenSkyServiceInterface {
    private cache: NodeCache;
    private activeAircraftCache: NodeCache;
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = WS_CONFIG.RECONNECT_ATTEMPTS;
    private readonly wsUrl: string;
    private readonly restUrl: string;
    private readonly cacheTTL = 15;
    private batchQueue: string[] = [];
    private pendingRequests = new Map<string, Promise<PositionData[]>>();
    private positionCallbacks = new Set<PositionUpdateCallback>();
    private subscribedIcao24s = new Set<string>();
    private clients = new Set<WebSocketClient>();

    constructor(
        private readonly username?: string,
        private readonly password?: string,
        private enableWebSocket = true
    ) {
        this.cache = new NodeCache({ stdTTL: this.cacheTTL });
        this.activeAircraftCache = new NodeCache({ 
            stdTTL: 300,
            checkperiod: 60 
        });
        this.restUrl = `${API_ENDPOINTS.OPENSKY_BASE}${API_ENDPOINTS.OPENSKY_STATES}`;
        this.wsUrl = this.constructWebSocketUrl();
        
        if (this.enableWebSocket) {
            this.initializeWebSocket();
        }
    }

    private getCachedData(key: string): PositionData[] | undefined {
      return this.cache.get<PositionData[]>(key);
  }

  private cacheData(key: string, data: PositionData[]): void {
      this.cache.set(key, data);
  }

  private parsePositionData(raw: any[]): PositionData | null {
    if (!Array.isArray(raw) || raw.length < 17) return null;

    const [
        icao24,
        _callsign,
        _origin_country,
        _time_position,
        rawLastContact,
        rawLongitude,
        rawLatitude,
        _baro_altitude,
        rawOnGround,
        rawVelocity,
        rawHeading,
        _vertical_rate,
        _sensors,
        rawAltitude,
        _squawk,
        _spi,
        _position_source
    ] = raw;

    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);

    // Validate required coordinates
    if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const lastContact = Number(rawLastContact);

    // Create position with required fields and defaults
    return {
        icao24: String(icao24),
        latitude,
        longitude,
        altitude: Number(rawAltitude) || 0,  // Default to 0 if NaN
        velocity: Number(rawVelocity) || 0,  // Default to 0 if NaN
        heading: Number(rawHeading) || 0,    // Default to 0 if NaN
        on_ground: Boolean(rawOnGround),     // Convert to boolean
        last_contact: (!isNaN(lastContact) && lastContact > 0) ? lastContact : currentTime
    };
}

private parseOpenSkyStates(rawStates: any[][]): PositionData[] {
    if (!Array.isArray(rawStates)) return [];

    return rawStates
        .map(state => this.parsePositionData(state))
        .filter((pos): pos is PositionData => pos !== null);
}

private validatePosition(position: Partial<PositionData>): position is PositionData {
  return Boolean(
      position.icao24 &&
      typeof position.latitude === 'number' &&
      typeof position.longitude === 'number' &&
      !isNaN(position.latitude) &&
      !isNaN(position.longitude) &&
      position.latitude >= -90 &&
      position.latitude <= 90 &&
      position.longitude >= -180 &&
      position.longitude <= 180 &&
      typeof position.on_ground === 'boolean' &&
      typeof position.last_contact === 'number'
  );
}

public positionToAircraft(pos: PositionData): Aircraft {
  return {
      icao24: pos.icao24,
      "N-NUMBER": "",
      manufacturer: "Unknown",
      model: "Unknown",
      operator: "Unknown",
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitude: pos.altitude ?? 0,       // Default to 0 if undefined
      heading: pos.heading ?? 0,         // Default to 0 if undefined
      velocity: pos.velocity ?? 0,       // Default to 0 if undefined
      on_ground: pos.on_ground,
      last_contact: pos.last_contact,
      NAME: "",
      CITY: "",
      STATE: "",
      isTracked: true
  };
}
  // Implement the getPositions method that was previously fetchPositions
  /** Fetch aircraft positions via the OpenSky REST API */
  public async getPositions(icao24s?: string[]): Promise<PositionData[]> {
    try {
        const cacheKey = icao24s?.sort().join(',') || 'all';
        
        // Check cache first
        const cachedData = this.cache.get<PositionData[]>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // Check pending requests
        const pendingRequest = this.pendingRequests.get(cacheKey);
        if (pendingRequest) {
            return pendingRequest;
        }

        const params = icao24s?.length ? 
            { [API_PARAMS.ICAO24]: icao24s.join(',') } : 
            undefined;

        const response = await axios.get<OpenSkyResponse>(this.restUrl, {
            params,
            auth: this.username && this.password
                ? { username: this.username, password: this.password }
                : undefined,
            timeout: 10000,
        });

        const positions = this.parseOpenSkyStates(response.data?.states || []);
        this.cache.set(cacheKey, positions);
        
        return positions;
    } catch (error) {
        console.error('Error fetching positions:', error);
        throw new OpenSkyError('Failed to fetch positions', error);
    }
}


public async getActiveCount(manufacturer: string, model?: string): Promise<ActiveCounts> {
  const cacheKey = `active_count:${manufacturer}${model ? `:${model}` : ''}`;
  
  const cached = this.cache.get<ActiveCounts>(cacheKey);
  if (cached) {
      return cached;
  }

  try {
      const queryParams = new URLSearchParams({ manufacturer });
      if (model) {
          queryParams.append('model', model);
      }

      // Get all ICAO24s for this manufacturer/model
      const response = await axios.get(`${API_ENDPOINTS.OPENSKY_BASE}/api/aircraft/icao24s?${queryParams}`);
      const icao24s: string[] = response.data?.icao24List || [];

      if (!icao24s.length) {
          const counts = { active: 0, total: icao24s.length };
          this.cache.set(cacheKey, counts);
          return counts;
      }

      // Get positions for these aircraft
      const positions = await this.getPositions(icao24s);
      
      // Count active aircraft (valid positions within the last 2 hours)
      const activeCount = positions.filter(pos => 
          this.validatePosition(pos) && 
          pos.last_contact > (Date.now() / 1000 - 7200)
      ).length;

      const counts: ActiveCounts = {
          active: activeCount,
          total: icao24s.length
      };

      this.cache.set(cacheKey, counts, 300); // Cache for 5 minutes
      return counts;
  } catch (error) {
      console.error('Error getting active aircraft count:', error);
      return { active: 0, total: 0 };
  }
}

  public clearActiveCache(manufacturer?: string, model?: string): void {
    if (manufacturer) {
        const pattern = `active_count:${manufacturer}${model ? `:${model}` : ''}`;
        const keys = this.activeAircraftCache.keys().filter((k: string) => k.startsWith(pattern));
        keys.forEach((key: string) => this.activeAircraftCache.del(key));
    } else {
        this.activeAircraftCache.flushAll();
    }
}
  /**
   * Constructs the WebSocket URL with authentication if provided.
   */
  private constructWebSocketUrl(): string {
    const base = `wss://${new URL(API_ENDPOINTS.OPENSKY_BASE).host}/api/websocket/`;
    if (this.username && this.password) {
      const encodedUser = encodeURIComponent(this.username);
      const encodedPass = encodeURIComponent(this.password);
      return `${base}auth?username=${encodedUser}&password=${encodedPass}`;
    }
    return base;
  }



  /**
   * Fetch aircraft positions via the OpenSky REST API.
   */
  public async fetchPositions(icao24s: string[]): Promise<PositionData[]> {
    try {
      // Check cache first
      const cacheKey = icao24s.sort().join(',');
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // Check for pending request
      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
        return pendingRequest;
      }

      // Make new request
      const request = this.makeRequest(icao24s);
      this.pendingRequests.set(cacheKey, request);

      try {
        const positions = await request;
        this.cacheData(cacheKey, positions);
        return positions;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw new OpenSkyError('Failed to fetch positions', error);
    }
  }

  private async makeRequest(icao24s: string[]): Promise<PositionData[]> {
    const params = icao24s.length
      ? { [API_PARAMS.ICAO24]: icao24s.join(',') }
      : undefined;

    const response = await axios.get<OpenSkyResponse>(this.restUrl, {
      params,
      auth: this.username && this.password
        ? { username: this.username, password: this.password }
        : undefined,
      timeout: 10000,
    });

    if (!response.data?.states) return [];
    return this.parseOpenSkyStates(response.data.states);
  }


  public onPositionUpdate(callback: PositionUpdateCallback): void {
    this.positionCallbacks.add(callback);
}

public removePositionUpdateCallback(callback: PositionUpdateCallback): void {
    this.positionCallbacks.delete(callback);
}

public async subscribeToAircraft(icao24s: string[]): Promise<void> {
  // Keep existing subscription logic
  icao24s.forEach(icao => this.subscribedIcao24s.add(icao));

  if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
          type: 'subscribe',
          filters: {
              states: true,
              icao24: Array.from(this.subscribedIcao24s)
          }
      };
      this.ws.send(JSON.stringify(message));

      // Add database update for initial state
      try {
          const db = await getDb();
          // Mark these aircraft as potentially active
          await db.run(`
              UPDATE aircraft 
              SET 
                  is_active = 1,
                  updated_at = datetime('now')
              WHERE icao24 IN (${icao24s.map(() => '?').join(',')})
          `, icao24s);
      } catch (error) {
          console.error('Error updating aircraft active status:', error);
      }
  }
}

public async unsubscribeFromAircraft(icao24s: string[]): Promise<void> {
  icao24s.forEach(icao => this.subscribedIcao24s.delete(icao));

  if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
          type: 'unsubscribe',
          filters: { icao24: icao24s }
      };
      this.ws.send(JSON.stringify(message));

      // Add database cleanup
      try {
          const db = await getDb();
          await db.run(`
              UPDATE aircraft 
              SET 
                  is_active = 0,
                  last_contact = NULL,
                  latitude = NULL,
                  longitude = NULL,
                  altitude = NULL,
                  velocity = NULL,
                  heading = NULL,
                  on_ground = 0,
                  updated_at = NULL
              WHERE icao24 IN (${icao24s.map(() => '?').join(',')})
          `, icao24s);
      } catch (error) {
          console.error('Error clearing aircraft active status:', error);
      }
  }
}

  /**
   * WebSocket handling methods
   */
  private initializeWebSocket(): void {
    if (!this.wsUrl || this.ws) return;

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', this.handleWebSocketOpen.bind(this));
      this.ws.on('message', this.handleWebSocketMessage.bind(this));
      this.ws.on('error', this.handleWebSocketError.bind(this));
      this.ws.on('close', this.handleWebSocketClose.bind(this));
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.handleWebSocketError(error);
    }
  }

  private handleWebSocketOpen(): void {
    console.log('WebSocket connection established');
    this.reconnectAttempts = 0;
    this.broadcastConnectionStatus(true);
  }

  private async handleWebSocketMessage(data: WebSocket.Data): Promise<void> {
    try {
        const message = JSON.parse(data.toString());
        if (message.states) {
            const positions = this.parseOpenSkyStates(message.states);
           
            // Filter positions for subscribed aircraft
            const subscribedPositions = positions.filter(
                pos => this.subscribedIcao24s.has(pos.icao24)
            );

            if (subscribedPositions.length > 0) {
                try {
                    const db = await getDb();
                    // Use a transaction for better performance
                    await db.run('BEGIN TRANSACTION');

                    for (const position of subscribedPositions) {
                        await db.run(`
                            UPDATE aircraft 
                            SET 
                                is_active = 1,
                                last_contact = ?,
                                latitude = ?,
                                longitude = ?,
                                altitude = ?,
                                velocity = ?,
                                heading = ?,
                                on_ground = ?,
                                updated_at = datetime('now')
                            WHERE icao24 = ?
                        `, [
                            position.last_contact,
                            position.latitude,
                            position.longitude,
                            position.altitude,
                            position.velocity,
                            position.heading,
                            position.on_ground ? 1 : 0,
                            position.icao24
                        ]);
                    }

                    await db.run('COMMIT');

                    // Maintain existing broadcast behavior
                    this.broadcastPositions(subscribedPositions);
                    
                    // Use Promise.all for callbacks
                    await Promise.all(
                        Array.from(this.positionCallbacks).map(callback => 
                            callback(subscribedPositions)
                        )
                    );

                } catch (error) {
                    console.error('Error updating aircraft positions:', error);
                    // Ensure transaction is rolled back on error
                    try {
                        const db = await getDb();
                        await db.run('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('Error rolling back transaction:', rollbackError);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing WebSocket message:', error);
    }

}

// Add the callback handling directly in the class
private async notifyCallbacks(positions: PositionData[]): Promise<void> {
  try {
      await Promise.all(
          Array.from(this.positionCallbacks).map(callback => 
              callback(positions).catch(error => {
                  console.error('Error in position callback:', error);
              })
          )
      );
  } catch (error) {
      console.error('Error notifying callbacks:', error);
  }
}

  private handleWebSocketError(error: unknown): void {
    console.error('WebSocket error:', error);
    this.broadcastConnectionStatus(false);
  }

  private handleWebSocketClose(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
    this.broadcastConnectionStatus(false);
    
    if (this.enableWebSocket && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      WS_CONFIG.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      WS_CONFIG.MAX_RECONNECT_DELAY
    );
    
    setTimeout(() => this.initializeWebSocket(), delay);
  }

  /**
   * Client management methods
   */
  public addClient(client: WebSocketClient): void {
    this.clients.add(client);
    if (client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, {
            type: 'connection_status',
            connected: this.ws?.readyState === WebSocket.OPEN
        });
    }
}

public removeClient(client: WebSocketClient): void {
    this.clients.delete(client);
}

  private broadcastPositions(positions: PositionData[]): void {
    this.broadcast({
      type: 'positions',
      data: positions
    });
  }

  private broadcastConnectionStatus(connected: boolean): void {
    this.broadcast({
      type: 'connection_status',
      connected
    });
  }

  private broadcast(message: unknown): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, messageStr);
      }
    });
  }

  private sendToClient(client: WebSocket, message: unknown): void {
    try {
      client.send(typeof message === 'string' ? message : JSON.stringify(message));
    } catch (error) {
      console.error('Error sending to client:', error);
      this.removeClient(client);
    }
  }

// Override cleanup to include active aircraft cache
public cleanup(): void {
  if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
  }
  this.ws = null;
  this.clients.clear();
  this.cache.close();
  this.activeAircraftCache.close();
  this.pendingRequests.clear();
  this.batchQueue = [];
  this.positionCallbacks.clear();
  this.subscribedIcao24s.clear();
}
}

// Export the service instance with the interface type
export const openSkyService: OpenSkyServiceInterface = new OpenSkyService(
process.env.OPENSKY_USERNAME,
process.env.OPENSKY_PASSWORD,
true
);
