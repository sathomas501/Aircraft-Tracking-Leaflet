// lib/services/OpenSkyTrackingService.ts

import { Aircraft } from '@/types/base';

// Track active requests to prevent duplicate calls
const activeRequests: Map<string, Promise<any>> = new Map();

// Cache tracking data with TTL
interface TrackingCache {
  data: any;
  timestamp: number;
  ttl: number;
}
const trackingCache: Map<string, TrackingCache> = new Map();

/**
 * Service for interacting with OpenSky tracking data
 */
class OpenSkyTrackingService {
  private static instance: OpenSkyTrackingService;
  private pendingRefresh: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private currentManufacturer: string | null = null;
  private subscribers = new Set<(data: any) => void>();

  // Tracking state
  private trackingActive = false;
  private trackedAircraft: Aircraft[] = [];
  private lastRefreshTime: number = 0;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): OpenSkyTrackingService {
    if (!OpenSkyTrackingService.instance) {
      OpenSkyTrackingService.instance = new OpenSkyTrackingService();
    }
    return OpenSkyTrackingService.instance;
  }

  /**
   * Subscribe to tracking updates
   */
  public subscribe(callback: (data: any) => void): () => void {
    this.subscribers.add(callback);

    // Immediately call with current data if available
    if (this.trackedAircraft.length > 0) {
      callback({
        aircraft: this.trackedAircraft,
        manufacturer: this.currentManufacturer,
        timestamp: this.lastRefreshTime,
      });
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Start tracking a manufacturer's aircraft
   */
  public async startTracking(manufacturer: string): Promise<Aircraft[]> {
    if (this.trackingActive && this.currentManufacturer === manufacturer) {
      console.log(`[OpenSky] Already tracking ${manufacturer}`);
      return this.trackedAircraft;
    }

    // Stop any existing tracking
    this.stopTracking();

    if (!manufacturer) {
      return [];
    }

    console.log(`[OpenSky] Starting tracking for ${manufacturer}`);
    this.currentManufacturer = manufacturer;
    this.trackingActive = true;

    // Initial fetch
    await this.fetchAndUpdateAircraft(manufacturer);

    // Set up refresh interval (every 30 seconds)
    this.refreshInterval = setInterval(() => {
      if (!this.pendingRefresh) {
        this.pendingRefresh = true;
        this.fetchAndUpdateAircraft(manufacturer).finally(() => {
          this.pendingRefresh = false;
        });
      }
    }, 30000);

    return this.trackedAircraft;
  }

  /**
   * Stop tracking aircraft
   */
  public stopTracking(): void {
    console.log('[OpenSky] Stopping tracking');
    this.trackingActive = false;
    this.currentManufacturer = null;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    this.trackedAircraft = [];
    this.notifySubscribers();
  }

  /**
   * Fetch aircraft data
   */
  private async fetchAndUpdateAircraft(manufacturer: string): Promise<void> {
    try {
      console.log(`[OpenSky] Fetching aircraft for ${manufacturer}`);

      // First get ICAO codes for this manufacturer
      const icao24s = await this.getIcao24sForManufacturer(manufacturer);

      if (icao24s.length === 0) {
        console.log(`[OpenSky] No ICAO codes found for ${manufacturer}`);
        this.trackedAircraft = [];
        this.notifySubscribers();
        return;
      }

      // Then get live tracking data for these ICAO codes
      const liveAircraft = await this.getLiveAircraftData(
        manufacturer,
        icao24s
      );

      // Update tracked aircraft and notify subscribers
      this.trackedAircraft = liveAircraft;
      this.lastRefreshTime = Date.now();
      this.notifySubscribers();

      console.log(
        `[OpenSky] Updated tracking data for ${manufacturer}: ${liveAircraft.length} aircraft`
      );
    } catch (error) {
      console.error(
        `[OpenSky] Error fetching aircraft for ${manufacturer}:`,
        error
      );
    }
  }

  /**
   * Get ICAO24 codes for a manufacturer
   */
  private async getIcao24sForManufacturer(
    manufacturer: string
  ): Promise<string[]> {
    // Check if we already have an active request
    const requestKey = `icao24s-${manufacturer}`;

    if (activeRequests.has(requestKey)) {
      console.log(
        `[OpenSky] Using existing ICAO24s request for ${manufacturer}`
      );
      return activeRequests.get(requestKey)!;
    }

    // Make a new request
    const request = new Promise<string[]>(async (resolve, reject) => {
      try {
        const response = await fetch('/api/aircraft/icao24s', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manufacturer }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ICAO24s: ${response.statusText}`);
        }

        const data = await response.json();
        resolve(data.icao24s || []);
      } catch (error) {
        console.error(
          `[OpenSky] Error fetching ICAO24s for ${manufacturer}:`,
          error
        );
        reject(error);
      } finally {
        // Remove from active requests
        activeRequests.delete(requestKey);
      }
    });

    // Store in active requests
    activeRequests.set(requestKey, request);

    return request;
  }

  /**
   * Get live aircraft data from OpenSky
   */
  private async getLiveAircraftData(
    manufacturer: string,
    icao24s: string[]
  ): Promise<Aircraft[]> {
    const cacheKey = `live-${manufacturer}`;
    const cached = trackingCache.get(cacheKey);

    // Check if we have fresh cached data
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`[OpenSky] Using cached live data for ${manufacturer}`);
      return cached.data;
    }

    // Check if we already have an active request
    if (activeRequests.has(cacheKey)) {
      console.log(
        `[OpenSky] Using existing live data request for ${manufacturer}`
      );
      return activeRequests.get(cacheKey)!;
    }

    // Make a new request
    const request = new Promise<Aircraft[]>(async (resolve, reject) => {
      try {
        const response = await fetch('/api/tracking/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manufacturer,
            icao24s,
            includeStatic: true, // Request to include static aircraft data
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch live data: ${response.statusText}`);
        }

        const data = await response.json();
        const aircraft = data.aircraft || [];

        // Cache the result for 20 seconds
        trackingCache.set(cacheKey, {
          data: aircraft,
          timestamp: Date.now(),
          ttl: 20000, // 20 seconds
        });

        resolve(aircraft);
      } catch (error) {
        console.error(
          `[OpenSky] Error fetching live data for ${manufacturer}:`,
          error
        );
        reject(error);
      } finally {
        // Remove from active requests
        activeRequests.delete(cacheKey);
      }
    });

    // Store in active requests
    activeRequests.set(cacheKey, request);

    return request;
  }

  /**
   * Notify all subscribers of changes
   */
  private notifySubscribers(): void {
    const data = {
      aircraft: this.trackedAircraft,
      manufacturer: this.currentManufacturer,
      count: this.trackedAircraft.length,
      timestamp: this.lastRefreshTime,
    };

    this.subscribers.forEach((callback) => callback(data));
  }

  /**
   * Force a refresh of tracking data
   */
  public async refreshTracking(): Promise<void> {
    if (!this.trackingActive || !this.currentManufacturer) {
      return;
    }

    await this.fetchAndUpdateAircraft(this.currentManufacturer);
  }

  /**
   * Get currently tracked aircraft
   */
  public getTrackedAircraft(): Aircraft[] {
    return this.trackedAircraft;
  }

  /**
   * Check if tracking is active
   */
  public isTrackingActive(): boolean {
    return this.trackingActive;
  }

  /**
   * Get currently tracked manufacturer
   */
  public getCurrentManufacturer(): string | null {
    return this.currentManufacturer;
  }
}

// Export singleton instance
const openSkyTrackingService = OpenSkyTrackingService.getInstance();
export default openSkyTrackingService;
