import type { Aircraft, OpenSkyStateArray } from '../../../types/base';
import { OpenSkyTransforms } from '@/utils/aircraft-transform1';
import CacheManager from '@/lib/services/managers/cache-manager'; // ✅ Import Cache Manager
import { IcaoBatchProcessor } from '../../../utils/icao-batch-processor'; // ✅ Import batch processor

interface Subscriber {
  callback: (aircraft: Aircraft[]) => void;
  manufacturer: string;
}

export class ClientTrackingService {
  private static readonly CHUNK_SIZE = 200;
  private static instance: ClientTrackingService;
  private subscribers: Set<Subscriber>;
  private pollingInterval: NodeJS.Timeout | null;
  private currentManufacturer: string | null;
  private currentIcao24s: string[];
  private noActiveAircraft: boolean = false;
  private cache: CacheManager<string[]>; // ✅ Use cache for ICAO24s
  private aircraftCache: CacheManager<Aircraft[]>; // ✅ Cache for active aircraft tracking
  private notifySubscribers(aircraft: Aircraft[]): void {
    this.subscribers.forEach((subscriber) => {
      if (subscriber.manufacturer === this.currentManufacturer) {
        subscriber.callback(aircraft);
      }
    });
  }
  private isPolling: boolean = false; // ✅ Add this line
  private icaoBatchProcessor: IcaoBatchProcessor; // ✅ Store batch processor instance

  private async startPolling(): Promise<void> {
    if (this.pollingInterval) return; // ✅ Prevent multiple polling instances

    this.pollingInterval = setInterval(async () => {
      if (this.isPolling) {
        console.log(
          '[Tracking] ⚠️ Skipping poll - previous request still running.'
        );
        return;
      }

      this.isPolling = true;
      await this.pollAircraftData();
      this.isPolling = false;
    }, 30000); // ✅ Poll every 30 seconds
  }

  private constructor() {
    this.subscribers = new Set();
    this.pollingInterval = null;
    this.currentManufacturer = null;
    this.icaoBatchProcessor = new IcaoBatchProcessor(); // ✅ Initialize batch processor
    this.currentIcao24s = [];
    this.aircraftCache = new CacheManager<Aircraft[]>(30); // Cache active aircraft for 30 seconds
    this.cache = new CacheManager<string[]>(5 * 60); // ✅ 5-minute ICAO24 cache
  }

  public static getInstance(): ClientTrackingService {
    if (!ClientTrackingService.instance) {
      ClientTrackingService.instance = new ClientTrackingService();
    }
    return ClientTrackingService.instance;
  }

  public async startTracking(manufacturer: string): Promise<void> {
    try {
      this.stopTracking();

      console.log(`[Tracking] 🔍 Validating database schema...`);
      await fetch('/api/database/validate', { method: 'POST' });

      this.currentManufacturer = manufacturer;

      // ✅ Ensure icao24List is always an array
      let icao24List: string[] = this.cache.get(manufacturer) ?? [];
      if (icao24List.length) {
        console.log(`[Tracking] ✅ Using cached ICAO24s for ${manufacturer}`);
      } else {
        console.log(
          `[Tracking] 🔍 Fetching ICAOs from API for ${manufacturer}`
        );

        try {
          const icaoResponse = await fetch('/api/aircraft/icao24s', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manufacturer }),
          });

          if (!icaoResponse.ok) {
            console.error(
              `[Tracking] ❌ Failed to fetch ICAO codes: ${icaoResponse.statusText}`
            );
            return;
          }

          const icaoData = await icaoResponse.json();

          if (
            !icaoData ||
            !icaoData.success ||
            !icaoData.data?.icao24List?.length
          ) {
            console.warn(
              `[Tracking] ❌ No ICAO codes found for ${manufacturer}`
            );
            this.notifySubscribers([]);
            return;
          }

          // ✅ Ensure icao24List is a valid array
          icao24List = icaoData.data.icao24List ?? [];

          this.cache.set(manufacturer, icao24List);
          console.log(
            `[Tracking] ✅ Cached ${icao24List.length} ICAOs for ${manufacturer}`
          );

          this.currentIcao24s = icao24List;

          console.log(
            `[Tracking] ✅ ICAOs retrieved. Starting initial tracking poll...`
          );

          // ✅ Immediately poll once before setting interval
          await this.pollAircraftData();

          // ✅ Set polling interval for continuous tracking
          this.startPolling();
        } catch (error) {
          // ✅ Properly closed inner try-catch
          console.error('[Tracking] ❌ Failed to fetch ICAO24s:', error);
          this.notifySubscribers([]);
        }
      }
    } catch (error) {
      console.error('[Tracking] ❌ Error in startTracking:', error);
    } // ✅ Ensure try-catch block is closed properly
  }

  /**
   * ✅ Helper function to compare aircraft arrays efficiently
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

  private async updateTrackingDatabase(aircraft: Aircraft[]): Promise<void> {
    if (!aircraft || aircraft.length === 0) {
      console.warn(`[Tracking] No aircraft data to update.`);
      return;
    }

    // ✅ Ensure `currentManufacturer` is always a string
    const manufacturer = this.currentManufacturer ?? '';

    // ✅ Check if the data has changed before updating
    const cachedAircraft = this.aircraftCache.get(manufacturer);

    // ✅ Compare arrays properly (avoid JSON.stringify)
    if (cachedAircraft && this.areAircraftEqual(cachedAircraft, aircraft)) {
      console.log(
        `[Tracking] ✅ No change in aircraft data. Skipping database update.`
      );
      return;
    }

    try {
      console.log(
        `[Tracking] ✅ Updating tracking database with ${aircraft.length} aircraft.`
      );
      await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertActiveAircraftBatch',
          positions: aircraft,
        }),
      });

      // ✅ Store updated aircraft in cache
      this.aircraftCache.set(manufacturer, aircraft);
    } catch (error) {
      console.error('[Tracking] ❌ Failed to update tracking database:', error);
    }
  }

  /**
   * ✅ Fix: Use batch processor to send ICAOs to OpenSky in chunks
   */
  public async pollAircraftData(): Promise<void> {
    if (!this.currentManufacturer || !this.currentIcao24s.length) {
      console.warn('[Tracking] No manufacturer or ICAO24s set. Skipping poll.');
      return;
    }

    // ✅ Prevent overlapping polling
    if (this.isPolling) {
      console.warn('[Tracking] Skipping poll, another poll is in progress.');
      return;
    }
    this.isPolling = true;

    try {
      console.log(
        `[Tracking] Checking tracking database for ${this.currentManufacturer}...`
      );

      const trackingResponse = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer: this.currentManufacturer, // ✅ Ensure manufacturer is used
          icao24s: this.currentIcao24s,
        }),
      });

      if (trackingResponse.ok) {
        const data = await trackingResponse.json();

        if (data.success && data.aircraft?.length > 0) {
          console.log(
            `[Tracking] ✅ Found ${data.aircraft.length} aircraft in tracking DB.`
          );
          this.notifySubscribers(data.aircraft);
          this.isPolling = false; // ✅ Reset flag
          return;
        }
      }

      console.log(`[Tracking] Fetching aircraft from OpenSky...`);

      // ✅ Use the batch processor to split requests
      const batchProcessor = new IcaoBatchProcessor();
      const aircraftData = await batchProcessor.processIcaoBatches(
        this.currentIcao24s,
        this.currentManufacturer!
      );

      if (aircraftData.length > 0) {
        await this.updateTrackingDatabase(aircraftData);
        this.notifySubscribers(aircraftData);
      } else {
        console.log('[Tracking] No active aircraft found.');
      }
    } catch (error) {
      console.error('[Tracking] Error polling aircraft data:', error);
    } finally {
      this.isPolling = false; // ✅ Always reset flag after execution
    }
  }

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
