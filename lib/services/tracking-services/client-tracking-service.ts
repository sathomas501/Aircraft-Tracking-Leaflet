import CacheManager from '@/lib/services/managers/cache-manager';
import { IcaoBatchService } from '../icao-batch-service';

interface Subscriber {
  callback: (aircraft: Aircraft[]) => void;
  manufacturer: string;
}

interface Aircraft {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  velocity: number;
  on_ground: boolean;
  last_contact: number;
  // Add other relevant fields
}

export class ClientTrackingService {
  private static instance: ClientTrackingService;
  private subscribers: Set<Subscriber>;
  private pollingInterval: NodeJS.Timeout | null;
  private currentManufacturer: string | null;
  private currentIcao24s: string[];
  private isPolling: boolean = false;
  private cache: CacheManager<string[]>;
  private aircraftCache: CacheManager<Aircraft[]>;
  private icaoBatchProcessor: IcaoBatchService;
  public get isPollingActive(): boolean {
    return this.isPolling;
  }

  private constructor() {
    this.subscribers = new Set();
    this.pollingInterval = null;
    this.currentManufacturer = null;
    this.icaoBatchProcessor = new IcaoBatchService();
    this.currentIcao24s = [];
    this.aircraftCache = new CacheManager<Aircraft[]>(30);
    this.cache = new CacheManager<string[]>(5 * 60);
  }

  public static getInstance(): ClientTrackingService {
    if (!ClientTrackingService.instance) {
      ClientTrackingService.instance = new ClientTrackingService();
    }
    return ClientTrackingService.instance;
  }

  /**
   * ✅ Notify subscribers when aircraft data updates
   */
  private notifySubscribers(aircraft: Aircraft[]): void {
    this.subscribers.forEach((subscriber) => {
      if (subscriber.manufacturer === this.currentManufacturer) {
        subscriber.callback(aircraft);
      }
    });
  }

  /**
   * ✅ Start polling aircraft data every 30 seconds
   */
  private startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      if (this.isPolling) {
        console.warn(
          '[Tracking] ⚠️ Skipping poll - previous request still running.'
        );
        return;
      }
      this.isPolling = true;
      await this.pollAircraftData();
      this.isPolling = false;
    }, 30000);
  }

  /**
   * ✅ Compare two aircraft arrays for changes
   */
  private areAircraftEqual(a: Aircraft[], b: Aircraft[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((aircraft, index) => {
      return (
        aircraft.icao24 === b[index].icao24 &&
        aircraft.latitude === b[index].latitude &&
        aircraft.longitude === b[index].longitude &&
        aircraft.altitude === b[index].altitude
      );
    });
  }

  public async startTracking(manufacturer: string): Promise<void> {
    try {
      this.stopTracking();
      console.log(`[Tracking] 🔍 Validating database schema...`);
      await fetch('/api/database/validate', { method: 'POST' });

      this.currentManufacturer = manufacturer;
      let icao24List: string[] = this.cache.get(manufacturer) ?? [];

      if (!icao24List.length) {
        console.log(
          `[Tracking] 🔍 Fetching ICAOs from API for ${manufacturer}`
        );
        try {
          const response = await fetch('/api/aircraft/icao24s', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manufacturer }),
          });

          if (!response.ok) {
            console.error(
              `[Tracking] ❌ Failed to fetch ICAO codes: ${response.statusText}`
            );
            return;
          }

          const data = await response.json();
          icao24List = data.data.icao24List ?? [];
          this.cache.set(manufacturer, icao24List);
          console.log(`[Tracking] ✅ Cached ${icao24List.length} ICAOs`);
        } catch (error) {
          console.error('[Tracking] ❌ Failed to fetch ICAO24s:', error);
          this.notifySubscribers([]);
          return;
        }
      }

      this.currentIcao24s = icao24List;
      console.log(`[Tracking] ✅ ICAOs retrieved. Starting tracking...`);
      await this.pollAircraftData();
      this.startPolling();
    } catch (error) {
      console.error('[Tracking] ❌ Error in startTracking:', error);
    }
  }

  /**
   * ✅ Poll aircraft data and update tracking
   */
  public async pollAircraftData(): Promise<void> {
    if (!this.currentManufacturer || !this.currentIcao24s.length) {
      console.warn('[Tracking] No manufacturer or ICAO24s set. Skipping poll.');
      return;
    }

    if (this.isPolling) {
      console.warn('[Tracking] Skipping poll, another poll is in progress.');
      return;
    }

    this.isPolling = true;
    let pollSuccess = false;

    try {
      console.log(
        `[Tracking] Checking tracking database for ${this.currentManufacturer}...`
      );

      // First try to get tracked aircraft
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer: this.currentManufacturer,
          icao24s: this.currentIcao24s,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch tracked aircraft: ${response.statusText}`
        );
      }

      const data = await response.json();
      const now = Date.now() / 1000;
      let shouldFetchFromOpenSky = false;

      if (data.success && Array.isArray(data.aircraft)) {
        console.log(
          `[Tracking] ✅ Found ${data.aircraft.length} aircraft in tracking DB.`
        );

        if (data.aircraft.length > 0) {
          shouldFetchFromOpenSky = data.aircraft.some(
            (ac: Aircraft) => now - ac.last_contact > 60
          );
          this.notifySubscribers(data.aircraft);
          pollSuccess = true;
        }
      }

      // ✅ Ensure that OpenSky is only called if NO valid aircraft exist
      if (shouldFetchFromOpenSky) {
        console.log(`[Tracking] Fetching aircraft from OpenSky...`);

        const aircraftData = await this.icaoBatchProcessor.processBatches(
          this.currentIcao24s,
          this.currentManufacturer
        );

        if (aircraftData.length > 0) {
          await this.updateTrackingDatabase(aircraftData);
          this.notifySubscribers(aircraftData);
          pollSuccess = true;
        } else {
          console.log('[Tracking] No active aircraft found in OpenSky.');
        }
      } else {
        console.log(
          '[Tracking] ✅ Skipping OpenSky fetch. Recent data available.'
        );
      }
    } catch (error) {
      console.error('[Tracking] ❌ Error polling aircraft data:', error);
      this.notifySubscribers([]);
    } finally {
      this.isPolling = false;

      if (!pollSuccess) {
        this.notifySubscribers([]);
      }
    }
  }

  /**
   * ✅ Fetch tracked aircraft from the API
   */
  public async getTrackedAircraft(): Promise<Aircraft[]> {
    try {
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST', // ✅ Ensure POST method
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft', // ✅ Ensure 'action' is included
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch aircraft data: ${response.status}`);
      }

      const data = await response.json();
      return data.aircraft || [];
    } catch (error) {
      console.error(
        '[TrackingService] ❌ Error fetching tracked aircraft:',
        error
      );
      return [];
    }
  }

  /**
   * ✅ Update aircraft in the tracking database
   */
  private async updateTrackingDatabase(aircraft: Aircraft[]): Promise<void> {
    if (!aircraft.length) {
      console.log(`[Tracking] No aircraft data to update.`);
      return;
    }

    const manufacturer = this.currentManufacturer ?? '';
    const cachedAircraft = this.aircraftCache.get(manufacturer);

    if (cachedAircraft && this.areAircraftEqual(cachedAircraft, aircraft)) {
      console.log(`[Tracking] ✅ No change in aircraft data. Skipping update.`);
      return;
    }

    try {
      console.log(
        `[Tracking] ✅ Updating tracking database with ${aircraft.length} aircraft.`
      );
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertActiveAircraftBatch',
          aircraft: aircraft, // Changed from 'positions' to 'aircraft'
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to update tracking database: ${response.statusText}`
        );
      }

      const result = await response.json();
      if (result.success) {
        console.log(`[Tracking] ✅ Successfully updated tracking database`);
        this.aircraftCache.set(manufacturer, aircraft);
      } else {
        console.error(
          `[Tracking] ❌ Failed to update tracking database:`,
          result.message
        );
      }
    } catch (error) {
      console.error('[Tracking] ❌ Failed to update tracking database:', error);
      throw error; // Re-throw to handle in the calling function
    }
  }

  /**
   * ✅ Stop tracking and clear active state
   */
  public stopTracking(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.currentManufacturer = null;
    this.currentIcao24s = [];
  }
}

export const clientTrackingService = ClientTrackingService.getInstance();
