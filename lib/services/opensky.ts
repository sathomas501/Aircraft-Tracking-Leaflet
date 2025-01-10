// lib/services/opensky.ts
import axios from 'axios';
import NodeCache from 'node-cache';
import WebSocket from 'ws';
import { RateLimiter } from './rate-limiter';
import {
  ICAO24_INDEX,
  LONGITUDE_INDEX,
  LATITUDE_INDEX,
  ALTITUDE_INDEX,
  VELOCITY_INDEX,
  HEADING_INDEX,
  ON_GROUND_INDEX,
  LAST_CONTACT_INDEX
} from '@/constants/aircraft';

import {
    API_ENDPOINTS,
    API_PARAMS,
    RETRY_ATTEMPTS,
    RETRY_DELAY,
    WS_RECONNECT_DELAY,
    
  } from '@/lib/api/constants';

  interface PositionData {
    icao24: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    velocity?: number;
    heading?: number;
    on_ground: boolean;
    last_contact?: number;
  }

    // Rate limiting configuration
const RATE_LIMITS = {
    ANONYMOUS: {
      requestsPerMinute: 100,
      requestsPerDay: 10000,
      batchSize: 25,
      minInterval: 5000,
    },
    AUTHENTICATED: {
      requestsPerMinute: 300,
      requestsPerDay: 50000,
      batchSize: 100,
      minInterval: 1000,
    }
  } as const;
  
  export class RateLimitedOpenSkyService {
    private cache: NodeCache;
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private wsReconnectAttempts = 0;
    private readonly maxWsReconnectAttempts = 5;
    private readonly wsUrl: string;
    private readonly restUrl: string;
    private readonly cacheTime = 15;
    private clients: Set<WebSocket> = new Set();
    private activeSubscriptions: Set<string> = new Set();
    private pendingRequests: Map<string, Promise<PositionData[]>> = new Map();
    private rateLimiter: RateLimiter;
    private lastRequestTime = 0;
    private batchQueue: string[] = [];
    private batchTimeout: NodeJS.Timeout | null = null;
  
    constructor(
      private readonly username?: string,
      private readonly password?: string,
      private isWebSocketEnabled = true
    ) {
      // Initialize cache
      this.cache = new NodeCache({ stdTTL: this.cacheTime });
      
      // Initialize rate limiter
      const limits = username && password ? RATE_LIMITS.AUTHENTICATED : RATE_LIMITS.ANONYMOUS;
      this.rateLimiter = new RateLimiter({
        maxRequests: limits.requestsPerMinute,
        interval: 60000,
        maxRequestsPerDay: limits.requestsPerDay
      });
  
      // Configure URLs
      this.restUrl = `${API_ENDPOINTS.OPENSKY_BASE}${API_ENDPOINTS.OPENSKY_STATES}`;
      
      if (username && password) {
        const encodedUsername = encodeURIComponent(username);
        const encodedPassword = encodeURIComponent(password);
        this.wsUrl = `wss://${new URL(API_ENDPOINTS.OPENSKY_BASE).host}/api/websocket/auth?username=${encodedUsername}&password=${encodedPassword}`;
      } else {
        this.wsUrl = `wss://${new URL(API_ENDPOINTS.OPENSKY_BASE).host}/api/websocket/`;
      }
  
      if (this.isWebSocketEnabled) {
        this.initializeWebSocket();
      }
    }
  
    private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
      let lastError: Error | null = null;
  
      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;
          console.error(`Attempt ${attempt} failed:`, error);
          
          if (attempt < RETRY_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          }
        }
      }
  
      throw lastError || new Error('Operation failed after retries');
    }
  
    private initializeWebSocket(): void {
      if (!this.isWebSocketEnabled || this.ws) return;
  
      try {
        const ws = new WebSocket(this.wsUrl);
        this.ws = ws;
  
        ws.on('open', () => {
          console.log('WebSocket connected');
          this.wsReconnectAttempts = 0;
          this.resubscribeAll();
        });
  
        ws.on('message', (data) => {
          try {
            const positions = this.parseWebSocketMessage(data);
            this.updateCacheAndBroadcast(positions);
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        });
  
        ws.on('close', () => {
          console.log('WebSocket connection closed');
          this.handleWebSocketClose();
        });
  
        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.handleWebSocketError(error);
        });
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        this.handleWebSocketError(error);
      }
    }
  
    private resubscribeAll(): void {
      if (this.activeSubscriptions.size === 0) return;
      
      const subscriptions = Array.from(this.activeSubscriptions);
      console.log('Resubscribing to aircraft:', subscriptions);
      
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          filters: { icao24: subscriptions }
        }));
      }
    }
  
    private parseWebSocketMessage(data: WebSocket.Data): PositionData[] {
      const message = JSON.parse(data.toString());
      if (!message.states) return [];
      return this.parseOpenSkyStates(message.states);
    }
  
    private parseOpenSkyStates(states: any[][]): PositionData[] {
      if (!Array.isArray(states)) return [];
  
      return states.reduce<PositionData[]>((acc, state) => {
        if (!state || !state[ICAO24_INDEX]) return acc;
  
        const longitude = parseFloat(state[LONGITUDE_INDEX]);
        const latitude = parseFloat(state[LATITUDE_INDEX]);
        
        if (isNaN(latitude) || isNaN(longitude)) return acc;
  
        acc.push({
          icao24: state[ICAO24_INDEX],
          latitude,
          longitude,
          altitude: typeof state[ALTITUDE_INDEX] === 'number' ? state[ALTITUDE_INDEX] : undefined,
          velocity: typeof state[VELOCITY_INDEX] === 'number' ? state[VELOCITY_INDEX] : undefined,
          heading: typeof state[HEADING_INDEX] === 'number' ? state[HEADING_INDEX] : undefined,
          on_ground: Boolean(state[ON_GROUND_INDEX]),
          last_contact: typeof state[LAST_CONTACT_INDEX] === 'number' ? state[LAST_CONTACT_INDEX] : undefined
        });
  
        return acc;
      }, []);
    }
  
    private updateCacheAndBroadcast(positions: PositionData[]): void {
      this.updateCache(positions);
      this.broadcastPositions(positions);
    }
  
    private updateCache(positions: PositionData[]): void {
      const cachedData = this.cache.get<Record<string, PositionData>>('positions') || {};
      positions.forEach(position => {
        cachedData[position.icao24] = position;
      });
      this.cache.set('positions', cachedData);
    }
  
    private broadcastPositions(positions: PositionData[]): void {
      const message = JSON.stringify(positions);
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
          } catch (error) {
            console.error('Error broadcasting to client:', error);
          }
        }
      });
    }
  
    private handleWebSocketClose(): void {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
      
      if (this.isWebSocketEnabled) {
        this.scheduleReconnect();
      }
    }
  
    private handleWebSocketError(error: unknown): void {
      console.error('WebSocket error:', error);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
      this.scheduleReconnect();
    }
  
    private scheduleReconnect(): void {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
  
      if (this.wsReconnectAttempts >= this.maxWsReconnectAttempts) {
        console.log('Max WebSocket reconnection attempts reached, disabling WebSocket');
        this.isWebSocketEnabled = false;
        return;
      }
  
      this.wsReconnectAttempts++;
      this.reconnectTimeout = setTimeout(() => {
        console.log(`Attempting WebSocket reconnection (${this.wsReconnectAttempts}/${this.maxWsReconnectAttempts})`);
        this.initializeWebSocket();
      }, WS_RECONNECT_DELAY * Math.pow(2, this.wsReconnectAttempts - 1));
    }
  
    // Public methods for external use
    public addClient(client: WebSocket): void {
      this.clients.add(client);
      console.log(`Client added. Total clients: ${this.clients.size}`);
      
      const cachedData = this.cache.get<Record<string, PositionData>>('positions');
      if (cachedData) {
        client.send(JSON.stringify(Object.values(cachedData)));
      }
    }
  
    public removeClient(client: WebSocket): void {
      this.clients.delete(client);
      console.log(`Client removed. Total clients: ${this.clients.size}`);
    }
  
    public async getPositions(icao24s?: string[]): Promise<PositionData[]> {
      const cachedData = this.cache.get<Record<string, PositionData>>('positions');
      if (cachedData) {
        const positions = icao24s 
          ? Object.values(cachedData).filter(pos => icao24s.includes(pos.icao24))
          : Object.values(cachedData);
        if (positions.length > 0) {
          return positions;
        }
      }
  
      const cacheKey = icao24s ? icao24s.sort().join(',') : 'all';
      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
        return pendingRequest;
      }
  
      const request = this.retryOperation(async () => {
        if (!this.rateLimiter.tryAcquire()) {
          throw new Error('Rate limit exceeded');
        }
  
        return this._fetchPositions(icao24s || []);
      });
  
      this.pendingRequests.set(cacheKey, request);
      
      try {
        const positions = await request;
        this.updateCache(positions);
        return positions;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    }
  
    private async _fetchPositions(icao24s: string[]): Promise<PositionData[]> {
      const response = await axios.get(this.restUrl, {
        params: icao24s.length ? { [API_PARAMS.ICAO24]: icao24s.join(',') } : undefined,
        auth: this.username && this.password 
          ? { username: this.username, password: this.password }
          : undefined,
        timeout: 10000
      });
  
      if (!response.data?.states) {
        throw new Error('No aircraft state data received');
      }
  
      return this.parseOpenSkyStates(response.data.states);
    }
  
    public cleanup(): void {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      if (this.ws) {
        this.ws.close();
      }
      this.cache.close();
      this.clients.clear();
      this.activeSubscriptions.clear();
    }
  }
  
  // Create singleton instance
  export const openSkyService = new RateLimitedOpenSkyService(
    process.env.NEXT_PUBLIC_OPENSKY_USERNAME,
    process.env.NEXT_PUBLIC_OPENSKY_PASSWORD,
    true
  );