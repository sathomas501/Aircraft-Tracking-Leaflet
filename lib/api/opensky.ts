// lib/services/opensky.ts
import axios from 'axios';
import WebSocket from 'ws';
import NodeCache from 'node-cache';
import type { 
    OpenSkyResponse, 
    PositionData, 
    WebSocketMessage,
    OpenSkyState,
    OpenSkyUtils
} from '@/types/api/opensky';
import {
    OPENSKY_INDICES,
    API_ENDPOINTS,
    API_PARAMS,
    WS_CONFIG,
} from '@/lib/api/constants';

type PositionUpdateCallback = (positions: PositionData[]) => Promise<void>;
type WebSocketClient = WebSocket;

export class OpenSkyError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'OpenSkyError';
    }
}

class OpenSkyService {
    private cache: NodeCache;
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
        this.restUrl = `${API_ENDPOINTS.OPENSKY_BASE}${API_ENDPOINTS.OPENSKY_STATES}`;
        this.wsUrl = this.constructWebSocketUrl();
        
        if (this.enableWebSocket) {
            this.initializeWebSocket();
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

  private broadcastPositions(positions: PositionData[]): void {
      const messageStr = JSON.stringify({
          type: 'positions',
          data: positions
      });

      Array.from(this.positionCallbacks).forEach(callback => {
          callback(positions).catch(error => {
              console.error('Error in position callback:', error);
          });
      });
  }

  public onPositionUpdate(callback: PositionUpdateCallback): void {
      this.positionCallbacks.add(callback);
  }

  public removePositionUpdateCallback(callback: PositionUpdateCallback): void {
      this.positionCallbacks.delete(callback);
  }

  public unsubscribeFromAircraft(icao24s: string[]): void {
      icao24s.forEach(icao => this.subscribedIcao24s.delete(icao));

      if (this.ws?.readyState === WebSocket.OPEN) {
          const message: WebSocketMessage = {
              type: 'unsubscribe',
              filters: { icao24: icao24s }
          };
          this.ws.send(JSON.stringify(message));
      }
  }

  private broadcastConnectionStatus(connected: boolean): void {
    console.log(`Broadcasting connection status: ${connected ? 'Connected' : 'Disconnected'}`);
    this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'connectionStatus', connected }));
        }
    });
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

  private constructWebSocketUrl(): string {
    const base = `wss://${new URL(API_ENDPOINTS.OPENSKY_BASE).host}/api/websocket/`;
    if (this.username && this.password) {
      const encodedUser = encodeURIComponent(this.username);
      const encodedPass = encodeURIComponent(this.password);
      return `${base}auth?username=${encodedUser}&password=${encodedPass}`;
    }
    return base;
  }

  private cacheData(key: string, data: PositionData[]): void {
    this.cache.set(key, data);
}

  private getCachedData(key: string): PositionData[] | undefined {
    return this.cache.get<PositionData[]>(key);
}

  /** Fetch aircraft positions via the OpenSky REST API */
  public async fetchPositions(icao24s: string[]): Promise<PositionData[]> {
    try {
      const cacheKey = icao24s.sort().join(',');
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
        return pendingRequest;
      }

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
      auth:
        this.username && this.password
          ? { username: this.username, password: this.password }
          : undefined,
      timeout: 10000,
    });

    if (!response.data?.states) return [];
    return this.parseOpenSkyStates(response.data.states);
  }

  private parseOpenSkyStates(rawStates: any[][]): PositionData[] {
    if (!Array.isArray(rawStates)) return [];

    const isValidCoordinate = (value: unknown): value is number =>
        typeof value === 'number' && !isNaN(value);

    return rawStates.reduce<PositionData[]>((acc, state) => {
        if (!Array.isArray(state) || state.length < 17) {
            console.warn('Invalid state vector:', state);
            return acc;
        }

        const [
            icao24,
            _callsign,
            _origin_country,
            _time_position,
            last_contact,
            longitude,
            latitude,
            _baro_altitude,
            on_ground,
            velocity,
            heading,
            _vertical_rate,
            _sensors,
            altitude,
            _squawk,
            _spi,
            _position_source
        ] = state;

        if (isValidCoordinate(latitude) && isValidCoordinate(longitude)) {
            const position: PositionData = {
                icao24: String(icao24),
                latitude,
                longitude,
                altitude: isValidCoordinate(altitude) ? altitude : undefined,
                velocity: isValidCoordinate(velocity) ? velocity : undefined,
                heading: isValidCoordinate(heading) ? heading : undefined,
                on_ground: Boolean(on_ground),
                last_contact: isValidCoordinate(last_contact) ? last_contact : Date.now() / 1000
            };

            if (this.validatePosition(position)) {
                acc.push(position);
            }
        }
        return acc;
    }, []);
}

    public async subscribeToAircraft(icao24s: string[]): Promise<void> {
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
        }
    }

    // Override the existing handleWebSocketMessage to include callbacks
    private handleWebSocketMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            if (message.states) {
                const positions = this.parseOpenSkyStates(message.states);
                
                // Filter positions for subscribed aircraft
                const subscribedPositions = positions.filter(
                    pos => this.subscribedIcao24s.has(pos.icao24)
                );

                if (subscribedPositions.length > 0) {
                    // Broadcast to WebSocket clients
                    this.broadcastPositions(subscribedPositions);

                    // Notify callbacks
                    this.notifyCallbacks(subscribedPositions);
                }
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    }

    // Override cleanup to handle callbacks and subscriptions
    public cleanup(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
        this.ws = null;
        this.clients.clear();
        this.cache.close();
        this.pendingRequests.clear();
        this.batchQueue = [];
        this.positionCallbacks.clear();
        this.subscribedIcao24s.clear();
    }

    // Alias getPositions to match the interface used by manufacturer tracking
    public getPositions(icao24s?: string[]): Promise<PositionData[]> {
        return this.fetchPositions(icao24s || []);
    }

    private handleWebSocketOpen(): void {
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
        this.broadcastConnectionStatus(true);

        // Resubscribe to aircraft if there are any
        if (this.subscribedIcao24s.size > 0) {
            const message: WebSocketMessage = {
                type: 'subscribe',
                filters: {
                    states: true,
                    icao24: Array.from(this.subscribedIcao24s)
                }
            };
            this.ws?.send(JSON.stringify(message));
        }
    }

    private sendToClient(client: WebSocketClient, message: unknown): void {
      try {
          const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
          if (client.readyState === WebSocket.OPEN) {
              client.send(messageStr);
          }
      } catch (error) {
          console.error('Error sending to client:', error);
          this.removeClient(client);
      }
  }
  
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
  
  private broadcastToClients(message: unknown): void {
      const messageStr = JSON.stringify(message);
      Array.from(this.clients).forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
              this.sendToClient(client, messageStr);
          }
      });
  }
  
  private async notifyCallbacks(positions: PositionData[]): Promise<void> {
      await Promise.all(
          Array.from(this.positionCallbacks).map(async (callback) => {
              try {
                  await callback(positions);
              } catch (error) {
                  console.error('Error in position update callback:', error);
              }
          })
      );
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
          typeof position.on_ground === 'boolean'
      );
  }
  
  // Export singleton instance
}
export const openSkyService = new OpenSkyService(
    process.env.OPENSKY_USERNAME,
    process.env.OPENSKY_PASSWORD,
    true
);

export const parsePosition = (rawData: any[]): PositionData | null => {
    if (!Array.isArray(rawData) || rawData.length < 17) {
        return null;
    }

    const [
        icao24,
        _callsign,
        _origin_country,
        _time_position,
        last_contact,
        longitude,
        latitude,
        _baro_altitude,
        on_ground,
        velocity,
        heading,
        _vertical_rate,
        _sensors,
        altitude,
        _squawk,
        _spi,
        _position_source
    ] = rawData;

    // Ensure required fields are present and valid
    if (
        typeof icao24 !== 'string' ||
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        typeof on_ground !== 'boolean' ||
        typeof last_contact !== 'number' ||
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return {
        icao24,
        latitude,
        longitude,
        altitude: typeof altitude === 'number' && !isNaN(altitude) ? altitude : undefined,
        velocity: typeof velocity === 'number' && !isNaN(velocity) ? velocity : undefined,
        heading: typeof heading === 'number' && !isNaN(heading) ? heading : undefined,
        on_ground: Boolean(on_ground),
        last_contact: Math.floor(last_contact) // Ensure it's a valid number
    };
};