import { errorHandler, ErrorType } from './error-handler';
import { PollingRateLimiter } from './rate-limiter';
import { CacheManager } from '../services/managers/cache-manager';
import { API_CONFIG } from '@/config/api';
import { RATE_LIMITS } from '../../config/rate-limits';
import { Aircraft } from '@/types/base';
import { upsertActiveAircraftBatch } from '../../pages/api/aircraft/tracking';

export interface Position {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  on_ground: boolean;
  last_contact: number;
}

export async function getAircraftPositions() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Database functions cannot be executed on the client side.'
    );
  }

  try {
    const response = await fetch(
      'http://localhost:3001/api/aircraft/tracking',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTrackedAircraft' }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch tracked aircraft: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      '[AircraftService] Error fetching aircraft positions:',
      error
    );
    throw error;
  }
}

export async function processAndStoreAircraftData(positions: Position[]) {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Database functions cannot be executed on the client side.'
    );
  }

  try {
    // Transform positions into tracking data
    const trackingData = positions.map((pos) => ({
      ...pos,
      updated_at: Date.now(),
    }));

    const response = await fetch(
      'http://localhost:3001/api/aircraft/tracking',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertActiveAircraftBatch',
          trackingData,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upsert aircraft data: ${response.statusText}`);
    }

    console.log(`[AircraftService] Upserted ${trackingData.length} records`);
  } catch (error) {
    console.error('[AircraftService] Error:', error);
    errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error as Error);
    throw error;
  }
}

class AircraftService {
  private static instance: AircraftService;
  private positions: Map<string, Position> = new Map();
  private positionHistory: Map<string, Position[]> = new Map();
  private positionExpiryTime = 5 * 60 * 1000; // 5 minutes
  private maxHistoryLength = 10;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private rateLimiter: PollingRateLimiter;
  private cacheManager: CacheManager<Position>;
  private baseUrl: string;

  private constructor() {
    this.rateLimiter = new PollingRateLimiter({
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
      requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
      maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
      minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
      maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
      retryLimit: RATE_LIMITS.AUTHENTICATED.MAX_RETRY_LIMIT,
      requireAuthentication: true,
    });

    this.cacheManager = new CacheManager<Position>(60);
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    this.startCleanupRoutine();
  }

  public static getInstance(): AircraftService {
    if (!AircraftService.instance) {
      AircraftService.instance = new AircraftService();
    }
    return AircraftService.instance;
  }

  private startCleanupRoutine(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.positions.forEach((pos, icao24) => {
        if (now - pos.last_contact > this.positionExpiryTime) {
          this.positions.delete(icao24);
          this.positionHistory.delete(icao24);
        }
      });
    }, 60000); // Clean up every minute
  }

  private shouldUpdatePosition(
    currentPos: Position,
    newPos: Position
  ): boolean {
    const minUpdateDistance = 10; // meters
    const minUpdateTime = 1000; // milliseconds

    if (newPos.last_contact - currentPos.last_contact > minUpdateTime) {
      return true;
    }

    const R = 6371e3;
    const φ1 = (currentPos.latitude * Math.PI) / 180;
    const φ2 = (newPos.latitude * Math.PI) / 180;
    const Δφ = ((newPos.latitude - currentPos.latitude) * Math.PI) / 180;
    const Δλ = ((newPos.longitude - currentPos.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const distance = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    return distance > minUpdateDistance;
  }

  public getPosition(icao24: string): Position | null {
    // Try cache first
    const cachedPosition = this.cacheManager.get(icao24);
    if (cachedPosition) return cachedPosition;

    // Fall back to memory store
    const position = this.positions.get(icao24);
    return position &&
      Date.now() - position.last_contact < this.positionExpiryTime
      ? position
      : null;
  }

  public getPositionHistory(icao24: string): Position[] {
    return this.positionHistory.get(icao24) || [];
  }

  private updatePosition(position: Position): void {
    const currentPos = this.positions.get(position.icao24);

    if (!currentPos || this.shouldUpdatePosition(currentPos, position)) {
      this.positions.set(position.icao24, position);
      this.cacheManager.set(position.icao24, position);

      const history = this.positionHistory.get(position.icao24) || [];
      if (
        !history.length ||
        history[history.length - 1].latitude !== position.latitude ||
        history[history.length - 1].longitude !== position.longitude
      ) {
        history.push(position);
        if (history.length > this.maxHistoryLength) {
          history.shift();
        }
        this.positionHistory.set(position.icao24, history);
      }
    }
  }

  private async fetchBatch(icao24s: string[]): Promise<Position[]> {
    const queryParams = new URLSearchParams({
      time: Math.floor(Date.now() / 1000).toString(),
      icao24: icao24s.join(','),
    });

    const url = `${this.baseUrl}/api/proxy/opensky?${queryParams}`;
    console.log('[AircraftService] Requesting:', {
      url,
      batchSize: icao24s.length,
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.states) {
      return [];
    }

    return data.states.map((state: any) => ({
      icao24: state[0],
      latitude: state[6] ?? 0,
      longitude: state[5] ?? 0,
      altitude: state[7] ?? 0,
      velocity: state[9] ?? 0,
      heading: state[10] ?? 0,
      on_ground: state[8] ?? false,
      last_contact: state[4] ?? Math.floor(Date.now() / 1000),
    }));
  }

  public async batchUpdate(icao24List: string[]): Promise<void> {
    await this.fetchAndUpdatePositions(icao24List);
  }

  public async fetchAndUpdatePositions(icao24s: string[]): Promise<Position[]> {
    if (!icao24s?.length) {
      console.warn('[fetchAndUpdatePositions] No ICAO24s provided.');
      return [];
    }

    const superBatchSize = API_CONFIG.PARAMS.MAX_TOTAL_ICAO_QUERY; // 1000 ICAOs per full request
    const subBatchSize = API_CONFIG.PARAMS.MAX_ICAO_QUERY; // 50 ICAOs per request
    const allPositions: Position[] = [];

    // Split into super batches (1000 each)
    for (let i = 0; i < icao24s.length; i += superBatchSize) {
      const superBatch = icao24s.slice(i, i + superBatchSize);

      // Process sub-batches (50 each)
      for (let j = 0; j < superBatch.length; j += subBatchSize) {
        const batch = superBatch.slice(j, j + subBatchSize);

        try {
          // Try to acquire a rate limit slot
          if (await this.rateLimiter.tryAcquire()) {
            const positions = await this.fetchBatch(batch);

            positions.forEach((pos) => {
              this.updatePosition(pos);
              allPositions.push(pos);
            });

            // Store transformed aircraft data in the database
            await processAndStoreAircraftData(positions);

            // Add delay between sub-batches
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(
            '[fetchAndUpdatePositions] Error processing batch:',
            error
          );
        }
      }
    }

    return allPositions;
  }

  public async fetchLiveData(icao24s: string[]): Promise<Aircraft[]> {
    if (!icao24s?.length) return [];
<<<<<<< Updated upstream
=======
    console.log('[fetchLiveData] Requesting live data for ICAO24s:', icao24s);
>>>>>>> Stashed changes

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const subBatchSize = API_CONFIG.PARAMS.MAX_ICAO_QUERY;
    const allAircraft: Aircraft[] = [];

    for (let i = 0; i < icao24s.length; i += subBatchSize) {
      const batch = icao24s
        .slice(i, i + subBatchSize)
        .map((id) => id.toLowerCase());

      const queryParams = new URLSearchParams();
      queryParams.set('time', Math.floor(Date.now() / 1000).toString());
      queryParams.set('icao24', batch.join(','));

      const url = `${baseUrl}/api/proxy/opensky?${queryParams.toString()}`;
      console.log('[fetchLiveData] Request:', { url, batchSize: batch.length });

      try {
        await this.rateLimiter.tryAcquire();
        const response = await fetch(url);
        console.log('[fetchLiveData] Response:', response.status);

        if (!response.ok) continue;

        const data = await response.json();
        if (data?.states?.length) {
          allAircraft.push(
            ...data.states.map((state: any) => ({
              icao24: state[0],
              'N-NUMBER': '',
              manufacturer: 'Unknown',
              model: 'Unknown',
              operator: 'Unknown',
              latitude: state[6] || 0,
              longitude: state[5] || 0,
              altitude: state[7] || 0,
              heading: state[10] || 0,
              velocity: state[9] || 0,
              on_ground: state[8] || false,
              last_contact: state[4] || Math.floor(Date.now() / 1000),
              lastSeen: Math.floor(Date.now() / 1000),
              NAME: '',
              CITY: '',
              STATE: '',
              OWNER_TYPE: 'Unknown',
              TYPE_AIRCRAFT: 'Unknown',
              isTracked: true,
            }))
          );
        }
      } catch (error) {
        console.error('[fetchLiveData] Error:', error);
<<<<<<< Updated upstream
=======
        const data = await response.json();
        console.log('[fetchLiveData] API Response:', data);

>>>>>>> Stashed changes
        errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error as Error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return allAircraft;
  }

  public async getLiveAircraftData(icao24s: string[]): Promise<Aircraft[]> {
    const positions = await this.fetchAndUpdatePositions(icao24s);
    return positions.map((pos) => ({
      icao24: pos.icao24,
      'N-NUMBER': '',
      manufacturer: 'Unknown',
      model: 'Unknown',
      operator: 'Unknown',
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitude: pos.altitude,
      heading: pos.heading,
      velocity: pos.velocity,
      on_ground: pos.on_ground,
      last_contact: pos.last_contact,
      lastSeen: Math.floor(Date.now() / 1000),
      NAME: '',
      CITY: '',
      STATE: '',
      OWNER_TYPE: 'Unknown',
      TYPE_AIRCRAFT: 'Unknown',
      isTracked: true,
    }));
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export functionality and types
export { AircraftService as UnifiedAircraftService };
export const aircraftService = AircraftService.getInstance();
export const fetchLiveData = (icao24s: string[]) =>
  aircraftService.fetchLiveData(icao24s);
