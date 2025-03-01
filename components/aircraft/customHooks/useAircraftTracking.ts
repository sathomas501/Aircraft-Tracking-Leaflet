// lib/services/client/aircraft-tracking-client.ts
import { Aircraft } from '@/types/base';

/**
 * Client-side service for interacting with the tracking API
 */
export class AircraftTrackingClient {
  private static instance: AircraftTrackingClient | null = null;
  private subscribers: Map<string, Set<(data: Aircraft[]) => void>> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private cache: Map<string, { data: Aircraft[]; timestamp: number }> =
    new Map();
  private readonly CACHE_DURATION = 5000; // 5 seconds
  private readonly POLL_INTERVAL = 30000; // 30 seconds

  private constructor() {}

  public static getInstance(): AircraftTrackingClient {
    if (!AircraftTrackingClient.instance) {
      AircraftTrackingClient.instance = new AircraftTrackingClient();
    }
    return AircraftTrackingClient.instance;
  }

  /**
   * Get tracked aircraft for a manufacturer
   */
  public async getTrackedAircraft(manufacturer: string): Promise<Aircraft[]> {
    // Check cache first
    const cacheKey = `aircraft-${manufacturer}`;
    const cachedData = this.cache.get(cacheKey);

    if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
      console.log(
        `[AircraftTrackingClient] Using cached data for ${manufacturer}`
      );
      return cachedData.data;
    }

    try {
      console.log(
        `[AircraftTrackingClient] Fetching aircraft for ${manufacturer}`
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
      console.error('[AircraftTrackingClient] Error fetching aircraft:', error);
      throw error;
    }
  }

  /**
   * Subscribe to aircraft updates for a manufacturer
   */
  public subscribe(
    manufacturer: string,
    callback: (data: Aircraft[]) => void
  ): () => void {
    // Create subscriber set if it doesn't exist
    if (!this.subscribers.has(manufacturer)) {
      this.subscribers.set(manufacturer, new Set());
    }

    // Add callback to subscribers
    this.subscribers.get(manufacturer)!.add(callback);

    // Start polling if not already polling for this manufacturer
    this.startPolling(manufacturer);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(manufacturer, callback);
    };
  }

  /**
   * Unsubscribe from aircraft updates
   */
  private unsubscribe(
    manufacturer: string,
    callback: (data: Aircraft[]) => void
  ): void {
    const subscribers = this.subscribers.get(manufacturer);

    if (subscribers) {
      subscribers.delete(callback);

      // If no more subscribers, stop polling
      if (subscribers.size === 0) {
        this.subscribers.delete(manufacturer);
        this.stopPolling(manufacturer);
      }
    }
  }

  /**
   * Start polling for aircraft updates
   */
  private startPolling(manufacturer: string): void {
    // Skip if already polling
    if (this.pollingIntervals.has(manufacturer)) {
      return;
    }

    console.log(
      `[AircraftTrackingClient] Starting polling for ${manufacturer}`
    );

    // Create polling interval
    const intervalId = setInterval(async () => {
      try {
        await this.getTrackedAircraft(manufacturer);
      } catch (error) {
        console.error(
          `[AircraftTrackingClient] Polling error for ${manufacturer}:`,
          error
        );
      }
    }, this.POLL_INTERVAL);

    // Save interval ID
    this.pollingIntervals.set(manufacturer, intervalId);
  }

  /**
   * Stop polling for aircraft updates
   */
  private stopPolling(manufacturer: string): void {
    const intervalId = this.pollingIntervals.get(manufacturer);

    if (intervalId) {
      console.log(
        `[AircraftTrackingClient] Stopping polling for ${manufacturer}`
      );
      clearInterval(intervalId);
      this.pollingIntervals.delete(manufacturer);
    }
  }

  /**
   * Notify subscribers of aircraft updates
   */
  private notifySubscribers(manufacturer: string, data: Aircraft[]): void {
    const subscribers = this.subscribers.get(manufacturer);

    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[AircraftTrackingClient] Callback error:`, error);
        }
      }
    }
  }

  /**
   * Update positions for aircraft
   */
  public async updatePositions(
    positions: Array<{
      icao24: string;
      latitude: number;
      longitude: number;
      altitude?: number;
      velocity?: number;
      heading?: number;
      on_ground?: boolean;
      manufacturer?: string;
    }>
  ): Promise<number> {
    if (!positions.length) return 0;

    try {
      const response = await fetch('/api/tracking/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertActiveAircraftBatch',
          aircraft: positions.map((p) => ({
            icao24: p.icao24,
            latitude: p.latitude,
            longitude: p.longitude,
            altitude: p.altitude || 0,
            velocity: p.velocity || 0,
            heading: p.heading || 0,
            on_ground: p.on_ground || false,
            manufacturer: p.manufacturer || '',
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Clear cache for affected manufacturers
      const manufacturers = new Set(
        positions.map((p) => p.manufacturer).filter(Boolean)
      );

      for (const manufacturer of manufacturers) {
        this.cache.delete(`aircraft-${manufacturer}`);
      }

      return result.count || 0;
    } catch (error) {
      console.error(
        '[AircraftTrackingClient] Error updating positions:',
        error
      );
      return 0;
    }
  }

  /**
   * Get tracked ICAO24 codes
   */
  public async getTrackedIcao24s(): Promise<string[]> {
    try {
      const response = await fetch('/api/tracking/index?action=tracked-icaos', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to get tracked ICAO24 codes');
      }

      return data.data?.icaos || [];
    } catch (error) {
      console.error(
        '[AircraftTrackingClient] Error fetching tracked ICAO24s:',
        error
      );
      return [];
    }
  }
}

// Export singleton instance
export const aircraftTrackingClient = AircraftTrackingClient.getInstance();
