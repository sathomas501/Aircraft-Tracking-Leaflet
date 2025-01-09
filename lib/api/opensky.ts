// lib/api/opensky.ts
import axios, { AxiosError } from 'axios';
import NodeCache from 'node-cache';
import type { 
  PositionData, 
  OpenSkyResponse, 
  WebSocketMessage,
  OpenSkyState 
} from '@/types/api/opensky';

export class OpenSkyError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OpenSkyError';
  }
}

class OpenSkyService {
  private cache: NodeCache;
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private wsReconnectAttempts = 0;
  private readonly maxWsReconnectAttempts = 5;
  private readonly wsUrl = 'wss://opensky-network.org/ws';
  private readonly restUrl = 'https://opensky-network.org/api/states/all';
  private readonly cacheTime = 15; // 15 seconds TTL
  private clients: Set<WebSocket> = new Set(); // Track WebSocket clients

  constructor(
    private readonly username?: string,
    private readonly password?: string,
    private isWebSocketEnabled = true
  ) {
    this.cache = new NodeCache({ stdTTL: this.cacheTime });

    if (isWebSocketEnabled && typeof window === 'undefined') {
      this.initWebSocket();
    }
  }

  public addClient(client: WebSocket): void {
    this.clients.add(client);
    console.log(`Client added. Total clients: ${this.clients.size}`);
  }

  public removeClient(client: WebSocket): void {
    this.clients.delete(client);
    console.log(`Client removed. Total clients: ${this.clients.size}`);
  }

  private initWebSocket(): void {
    if (!this.isWebSocketEnabled || this.ws) return;

    const WebSocket = require('ws');
    try {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;

      ws.onopen = this.handleWebSocketOpen.bind(this);
      ws.onmessage = this.handleWebSocketMessage.bind(this);
      ws.onclose = this.handleWebSocketClose.bind(this);
      ws.onerror = this.handleWebSocketError.bind(this);
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.handleWebSocketError(error as Error);
    }
  }

  private handleWebSocketOpen(): void {
    this.wsReconnectAttempts = 0;
    this.subscribeToUpdates();
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const positions = this.parseOpenSkyResponse(data);
      this.cache.set('positions', positions);
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }

  private handleWebSocketClose(): void {
    this.scheduleReconnect();
  }

  private handleWebSocketError(error: Error): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.wsReconnectAttempts >= this.maxWsReconnectAttempts) {
      this.isWebSocketEnabled = false;
      return;
    }

    this.wsReconnectAttempts++;
    const backoffTime = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
    
    this.reconnectTimeout = setTimeout(() => {
      this.initWebSocket();
    }, backoffTime);
  }

  private subscribeToUpdates(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: 'subscribe',
        filters: { states: true }
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  private parseStateVector(state: any[]): OpenSkyState {
    const [
      icao24,
      callsign,
      origin_country,
      time_position,
      last_contact,
      longitude,
      latitude,
      baro_altitude,
      on_ground,
      velocity,
      true_track,
      vertical_rate,
      sensors,
      geo_altitude,
      squawk,
      spi,
      position_source
    ] = state;

    return {
      icao24: String(icao24),
      callsign: callsign ? String(callsign) : null,
      origin_country: String(origin_country),
      time_position: time_position ? Number(time_position) : null,
      last_contact: Number(last_contact),
      longitude: longitude ? Number(longitude) : null,
      latitude: latitude ? Number(latitude) : null,
      baro_altitude: baro_altitude ? Number(baro_altitude) : null,
      on_ground: Boolean(on_ground),
      velocity: velocity ? Number(velocity) : null,
      true_track: true_track ? Number(true_track) : null,
      vertical_rate: vertical_rate ? Number(vertical_rate) : null,
      sensors: Array.isArray(sensors) ? sensors.map(Number) : null,
      geo_altitude: geo_altitude ? Number(geo_altitude) : null,
      squawk: squawk ? String(squawk) : null,
      spi: Boolean(spi),
      position_source: position_source ? Number(position_source) : 0
    };
  }

  private parseOpenSkyResponse(data: OpenSkyResponse): Record<string, PositionData> {
    return (data.states || []).reduce<Record<string, PositionData>>((acc, state) => {
      const parsedState = this.parseStateVector(state);
      
      if (parsedState.icao24) {
        acc[parsedState.icao24] = {
          icao24: parsedState.icao24,
          latitude: parsedState.latitude ?? undefined,
          longitude: parsedState.longitude ?? undefined,
          altitude: parsedState.baro_altitude ?? undefined,
          velocity: parsedState.velocity ?? undefined,
          heading: parsedState.true_track ?? undefined,
          on_ground: parsedState.on_ground,
          last_contact: parsedState.last_contact
        };
      }
      return acc;
    }, {});
  }

  public async getPositions(icao24s?: string[]): Promise<PositionData[]> {
    try {
      const cachedData = this.cache.get<Record<string, PositionData>>('positions');
      if (cachedData) {
        const positions = icao24s 
          ? Object.values(cachedData).filter(pos => icao24s.includes(pos.icao24))
          : Object.values(cachedData);
        return positions;
      }

      const response = await axios.get<OpenSkyResponse>(
        this.restUrl,
        {
          params: icao24s?.length ? { icao24: icao24s.join(',') } : undefined,
          auth: this.username && this.password 
            ? { username: this.username, password: this.password }
            : undefined,
          timeout: 5000
        }
      );

      if (!response.data?.states) {
        throw new OpenSkyError('No aircraft state data received');
      }

      const positions = this.parseOpenSkyResponse(response.data);
      this.cache.set('positions', positions);
      return Object.values(positions);

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new OpenSkyError(
          error.response?.data?.message || 'Failed to fetch aircraft positions',
          error.response?.status,
          error
        );
      }
      throw new OpenSkyError(
        'Failed to fetch positions',
        500,
        error instanceof Error ? error : undefined
      );
    }
  }

  public cleanup(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.cache.close();
  }
}

// Create singleton instance
export const openSkyService = new OpenSkyService(
  process.env.NEXT_PUBLIC_OPENSKY_USERNAME,
  process.env.NEXT_PUBLIC_OPENSKY_PASSWORD,
  true
);