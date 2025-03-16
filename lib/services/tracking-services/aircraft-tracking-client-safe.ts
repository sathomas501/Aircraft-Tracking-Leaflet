// lib/services/client/aircraft-tracking-client-safe.ts
import { Aircraft } from '@/types/base';

export class AircraftTrackingClientSafe {
  private static instance: AircraftTrackingClientSafe | null = null;
  private subscribers: Map<string, Set<(data: Aircraft[]) => void>> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private cache: Map<string, { data: Aircraft[]; timestamp: number }> =
    new Map();
  private readonly CACHE_DURATION = 5000; // 5 seconds
  private readonly POLL_INTERVAL = 30000; // 30 seconds

  private constructor() {}

  public static getInstance(): AircraftTrackingClientSafe {
    if (!AircraftTrackingClientSafe.instance) {
      AircraftTrackingClientSafe.instance = new AircraftTrackingClientSafe();
    }
    return AircraftTrackingClientSafe.instance;
  }

  public async manualRefresh(manufacturer: string): Promise<Aircraft[]> {
    console.log(
      `[AircraftTrackingClientSafe] Manual refresh triggered for ${manufacturer}`
    );

    // Clear the cache for this manufacturer to force a fresh API call
    this.cache.delete(`aircraft-${manufacturer}`);

    // Make the API call and return the aircraft data
    return this.getTrackedAircraft(manufacturer);
  }

  public async getTrackedAircraft(manufacturer: string): Promise<Aircraft[]> {
    // Rest of your implementation, but without any server-side dependencies
    // Similar to your existing code, but only with browser-safe operations

    // Check cache first
    const cacheKey = `aircraft-${manufacturer}`;
    const cachedData = this.cache.get(cacheKey);

    if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
      console.log(
        `[AircraftTrackingClientSafe] Using cached data for ${manufacturer}`
      );
      return cachedData.data;
    }

    try {
      console.log(
        `[AircraftTrackingClientSafe] Fetching aircraft for ${manufacturer}`
      );

      const response = await fetch(`/api/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const data = result.aircraft || [];

      // Update cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      // Notify subscribers
      this.notifySubscribers(manufacturer, data);

      return data;
    } catch (error) {
      console.error(
        '[AircraftTrackingClientSafe] Error fetching aircraft:',
        error
      );
      throw error;
    }
  }

  // Include other browser-safe methods you need...
  // (similar to your original client but without server dependencies)

  private notifySubscribers(manufacturer: string, data: Aircraft[]): void {
    const subscribers = this.subscribers.get(manufacturer);

    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[AircraftTrackingClientSafe] Callback error:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const aircraftTrackingClientSafe =
  AircraftTrackingClientSafe.getInstance();
