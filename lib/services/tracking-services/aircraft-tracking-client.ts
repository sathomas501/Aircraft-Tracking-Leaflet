// lib/services/client/aircraft-tracking-client.ts
import { Aircraft } from '@/types/base';
import { getAircraftTrackingService } from './aircraft-tracking-service';

export class AircraftTrackingClient {
  private static instance: AircraftTrackingClient | null = null;
  private subscribers: Map<string, Set<(data: Aircraft[]) => void>> = new Map();
  private trackingService = getAircraftTrackingService(); // Use the server-side service
  private cache: Map<string, { data: Aircraft[]; timestamp: number }> =
    new Map();
  private readonly CACHE_DURATION = 5000; // 5 seconds

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
      return cachedData.data;
    }

    try {
      console.log(
        `[AircraftTrackingClient] Fetching aircraft for ${manufacturer}`
      );
      const data = await this.trackingService.processManufacturer(manufacturer); // Use the server-side service

      // Cache the result
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('[AircraftTrackingClient] Error fetching aircraft:', error);
      throw error;
    }
  }

  /**
   * Subscribe to aircraft updates
   */
  public subscribe(
    manufacturer: string,
    callback: (data: Aircraft[]) => void
  ): () => void {
    if (!this.subscribers.has(manufacturer)) {
      this.subscribers.set(manufacturer, new Set());
    }
    this.subscribers.get(manufacturer)!.add(callback);

    // Fetch initial data
    this.getTrackedAircraft(manufacturer)
      .then((data) => callback(data))
      .catch((error) =>
        console.error('[AircraftTrackingClient] Subscription error:', error)
      );

    return () => {
      this.unsubscribe(manufacturer, callback);
    };
  }

  private unsubscribe(
    manufacturer: string,
    callback: (data: Aircraft[]) => void
  ): void {
    const subscribers = this.subscribers.get(manufacturer);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.subscribers.delete(manufacturer);
      }
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
          console.error('[AircraftTrackingClient] Callback error:', error);
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
      // Using updateAircraftPositions method which exists in AircraftTrackingService
      // Convert positions to the format expected by updateAircraftPositions
      const manufacturer = positions[0].manufacturer || '';

      // Convert positions to OpenSky state array format
      const openSkyFormat = positions.map((pos) => {
        // Create an array with minimum required properties for updateAircraftPositions
        // Format is based on the method's expectation in AircraftTrackingService
        return [
          pos.icao24, // icao24 at index 0
          '', // callsign (empty)
          '', // origin_country (empty)
          0, // time_position (not used)
          Math.floor(Date.now() / 1000), // last_contact
          pos.longitude, // longitude at index 5
          pos.latitude, // latitude at index 6
          pos.altitude || 0, // altitude at index 7
          pos.on_ground || false, // on_ground at index 8
          pos.velocity || 0, // velocity at index 9
          pos.heading || 0, // heading at index 10
          0, // vertical_rate (not used)
          [], // sensors (not used)
          0, // baro_altitude (not used)
          '', // squawk (not used)
          false, // spi (not used)
          0, // position_source (not used)
        ];
      });

      await this.trackingService.updateAircraftPositions(
        openSkyFormat,
        manufacturer
      );

      // Return the count of positions updated
      return positions.length;
    } catch (error) {
      console.error(
        '[AircraftTrackingClient] Error updating positions:',
        error
      );
      return 0;
    }
  }
}

// Export singleton instance
export const aircraftTrackingClient = AircraftTrackingClient.getInstance();
