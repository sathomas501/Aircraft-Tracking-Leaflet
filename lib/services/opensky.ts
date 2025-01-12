// lib/services/opensky.ts
import axios from 'axios';
import NodeCache from 'node-cache';
import WebSocket from 'ws';
import { RateLimiter } from './rate-limiter';
import { 
    PositionData, 
    OpenSkyState, 
    WebSocketMessage,
    OpenSkyResponse 
} from '@/types/api/opensky';
import {
    API_ENDPOINTS,
    API_PARAMS,
    RETRY_ATTEMPTS,
    RETRY_DELAY,
    WS_RECONNECT_DELAY,
} from '@/lib/api/constants';

import { 
    ICAO24_INDEX, 
    LONGITUDE_INDEX, 
    LATITUDE_INDEX,
    ALTITUDE_INDEX,
    VELOCITY_INDEX,
    HEADING_INDEX,
    ON_GROUND_INDEX,
    LAST_CONTACT_INDEX } from '@/lib/api/constants';

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

export class OpenSkyService {
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
   
   private parseWebSocketMessage(data: WebSocket.Data): PositionData[] {
      const message = JSON.parse(data.toString());
      if (!message.states) return [];
      return this.parseOpenSkyStates(message.states);
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
   
   public addClient(client: WebSocket): void {
      this.clients.add(client);
      console.log(`Client added. Total clients: ${this.clients.size}`);
      
      // Send initial cache data if available
      const cachedData = this.cache.get<Record<string, PositionData>>('positions');
      if (cachedData) {
          client.send(JSON.stringify(Object.values(cachedData)));
      }
   }
   
   public removeClient(client: WebSocket): void {
      this.clients.delete(client);
      console.log(`Client removed. Total clients: ${this.clients.size}`);
   }
   
   private updateCacheAndBroadcast(positions: PositionData[]): void {
      this.updateCache(positions);
      this.broadcastPositions(positions);
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
  
   // Position fetching methods for OpenSkyService

public async getPositions(icao24s?: string[]): Promise<PositionData[]> {
  try {
      // Try cache first
      const cachedData = this.cache.get<Record<string, PositionData>>('positions');
      if (cachedData) {
          const positions = icao24s 
              ? Object.values(cachedData).filter(pos => icao24s.includes(pos.icao24))
              : Object.values(cachedData);
          if (positions.length > 0) {
              return positions;
          }
      }

      // Check for pending request
      const cacheKey = icao24s ? icao24s.sort().join(',') : 'all';
      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
          return pendingRequest;
      }

      // Make new request with retry
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

  } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
  }
}

private async _fetchPositions(icao24s: string[]): Promise<PositionData[]> {
  const response = await axios.get<OpenSkyResponse>(
      this.restUrl,
      {
          params: icao24s.length ? { [API_PARAMS.ICAO24]: icao24s.join(',') } : undefined,
          auth: this.username && this.password 
              ? { username: this.username, password: this.password }
              : undefined,
          timeout: 10000
      }
  );

  if (!response.data?.states) {
      return [];
  }

  return this.parseOpenSkyStates(response.data.states);
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

// Rate limiting and batch processing methods for OpenSkyService

private async processBatchQueue(): Promise<void> {
  if (this.batchQueue.length === 0) return;

  const limits = this.username && this.password ? RATE_LIMITS.AUTHENTICATED : RATE_LIMITS.ANONYMOUS;
  const now = Date.now();
  const timeUntilNextRequest = Math.max(0, this.lastRequestTime + limits.minInterval - now);

  if (timeUntilNextRequest > 0) {
      await new Promise(resolve => setTimeout(resolve, timeUntilNextRequest));
  }

  try {
      while (this.batchQueue.length > 0) {
          // Check if we can make a request
          if (!this.rateLimiter.tryAcquire()) {
              console.log('Rate limit reached, waiting...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
          }

          const batch = this.batchQueue.splice(0, limits.batchSize);
          console.log(`Processing batch of ${batch.length} aircraft`);

          try {
              const positions = await this.retryOperation(() => this._fetchPositions(batch));
              this.updateCache(positions);
              this.broadcastPositions(positions);
          } catch (error) {
              console.error('Error processing batch:', error);
          }

          this.lastRequestTime = Date.now();
          
          // Add delay between batches
          if (this.batchQueue.length > 0) {
              await new Promise(resolve => setTimeout(resolve, limits.minInterval));
          }
      }
  } finally {
      this.batchTimeout = null;
  }
}

public async subscribeToAircraft(icao24s: string[]): Promise<void> {
  const newIcao24s = icao24s.filter(icao => !this.activeSubscriptions.has(icao));
  
  if (newIcao24s.length === 0) return;

  // Add to active subscriptions
  newIcao24s.forEach(icao => this.activeSubscriptions.add(icao));

  // Add to WebSocket subscription if available
  if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
          type: 'subscribe',
          filters: { icao24: newIcao24s }
      }));
  }

  // Queue for REST API fetching
  this.batchQueue.push(...newIcao24s);
  
  // Start batch processing if not already running
  if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.processBatchQueue(), 0);
  }
}

private async checkRateLimit(): Promise<void> {
  const limits = this.username && this.password 
      ? RATE_LIMITS.AUTHENTICATED 
      : RATE_LIMITS.ANONYMOUS;

  const now = Date.now();
  const timeSinceLastRequest = now - this.lastRequestTime;
  
  if (timeSinceLastRequest < limits.minInterval) {
      await new Promise(resolve => 
          setTimeout(resolve, limits.minInterval - timeSinceLastRequest)
      );
  }
  
  this.lastRequestTime = Date.now();
}

private getRateLimitInfo(): {
  remainingRequests: number;
  timeUntilReset: number;
  dailyRequestsRemaining?: number;
} {
  return {
      remainingRequests: this.rateLimiter.getRemainingRequests(),
      timeUntilReset: this.rateLimiter.getTimeUntilNextSlot(),
      dailyRequestsRemaining: this.rateLimiter.getRemainingDailyRequests()
  };
}

// Cache management methods for OpenSkyService

private updateCache(positions: PositionData[]): void {
  const cachedData = this.cache.get<Record<string, PositionData>>('positions') || {};
  const now = Date.now();

  positions.forEach(position => {
      // Only cache if position is recent (within last minute)
      if (position.last_contact && 
          now - position.last_contact * 1000 < 60000) {
          cachedData[position.icao24] = position;
      }
  });

  this.cache.set('positions', cachedData);
}

private cleanCache(): void {
  const cachedData = this.cache.get<Record<string, PositionData>>('positions');
  if (!cachedData) return;

  const now = Date.now();
  const cleanedData: Record<string, PositionData> = {};

  // Remove stale positions (older than 1 minute)
  Object.entries(cachedData).forEach(([icao24, position]) => {
      if (position.last_contact && 
          now - position.last_contact * 1000 < 60000) {
          cleanedData[icao24] = position;
      }
  });

  this.cache.set('positions', cleanedData);
}

private getCachedPositions(icao24s?: string[]): PositionData[] {
  const cachedData = this.cache.get<Record<string, PositionData>>('positions');
  if (!cachedData) return [];

  if (!icao24s) {
      return Object.values(cachedData);
  }

  return icao24s
      .map(icao24 => cachedData[icao24])
      .filter((position): position is PositionData => !!position);
}

private isCacheValid(): boolean {
  const cachedData = this.cache.get<Record<string, PositionData>>('positions');
  if (!cachedData) return false;

  const now = Date.now();
  return Object.values(cachedData).some(position => 
      position.last_contact && 
      now - position.last_contact * 1000 < 60000
  );
}

public invalidateCache(): void {
  this.cache.del('positions');
}

// Setup cache cleanup interval
private setupCacheCleanup(): void {
  setInterval(() => {
      this.cleanCache();
  }, 60000); // Clean every minute
}

// Method to get cache statistics
public getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  ttl: number;
} {
  return {
      size: this.cache.stats.keys,
      hits: this.cache.stats.hits,
      misses: this.cache.stats.misses,
      ttl: this.cacheTime
  };
}

// Cleanup and utility methods for OpenSkyService

// Primary cleanup method
public cleanup(): void {
  // Clear timeouts and intervals
  if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
  }
  if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
  }

  // Close WebSocket connection
  if (this.ws) {
      this.ws.close();
      this.ws = null;
  }

  // Clear all caches and queues
  this.cache.close();
  this.clients.clear();
  this.activeSubscriptions.clear();
  this.pendingRequests.clear();
  this.batchQueue = [];
}

// Utility methods for data validation and transformation
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
      position.longitude <= 180
  );
}

public getServiceStatus(): {
  wsConnected: boolean;
  wsReconnectAttempts: number;
  activeSubscriptions: number;
  connectedClients: number;
  batchQueueSize: number;
  pendingRequests: number;
} {
  return {
      wsConnected: this.ws?.readyState === WebSocket.OPEN,
      wsReconnectAttempts: this.wsReconnectAttempts,
      activeSubscriptions: this.activeSubscriptions.size,
      connectedClients: this.clients.size,
      batchQueueSize: this.batchQueue.length,
      pendingRequests: this.pendingRequests.size
  };
}

private formatPositionData(position: PositionData): PositionData {
  return {
    icao24: position.icao24,
    latitude: position.latitude !== undefined ? Number(position.latitude.toFixed(6)) : undefined,
    longitude: position.longitude !== undefined ? Number(position.longitude.toFixed(6)) : undefined,
    altitude: position.altitude !== undefined ? Number(position.altitude.toFixed(2)) : undefined,
    velocity: position.velocity !== undefined ? Number(position.velocity.toFixed(2)) : undefined,
    heading: position.heading !== undefined ? Number(position.heading.toFixed(2)) : undefined,
    on_ground: position.on_ground,
    last_contact: position.last_contact,
  };
}


public unsubscribeFromAircraft(icao24s: string[]): void {
  icao24s.forEach(icao => {
      this.activeSubscriptions.delete(icao);
  });

  if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
          type: 'unsubscribe',
          filters: { icao24: icao24s }
      }));
  }
}

public reset(): void {
  this.cleanup();
  this.wsReconnectAttempts = 0;
  this.lastRequestTime = 0;
  if (this.isWebSocketEnabled) {
      this.initializeWebSocket();
  }
}}

// Error handling, logging, and additional utility methods for OpenSkyService

// Custom error types
