// services/client/tracking-service.ts
import type { Aircraft, OpenSkyStateArray } from '../../../types/base';
import { OpenSkyTransforms } from '@/utils/aircraft-transform1';

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
  private noActiveAircraft: boolean = false; // 🚀 Prevents unnecessary repolling
  private constructor() {
    this.subscribers = new Set();
    this.pollingInterval = null;
    this.currentManufacturer = null;
    this.currentIcao24s = [];
  }

  public static getInstance(): ClientTrackingService {
    if (!ClientTrackingService.instance) {
      ClientTrackingService.instance = new ClientTrackingService();
    }
    return ClientTrackingService.instance;
  }

  private trackingActive: boolean = false; // Still private

  public isTrackingActive(): boolean {
    return this.trackingActive;
  }

  public setTrackingActive(state: boolean): void {
    this.trackingActive = state;
  }

  private async updateTrackingDatabase(aircraft: Aircraft[]): Promise<void> {
    if (!aircraft || aircraft.length === 0) {
      console.warn(`[Tracking] No aircraft data to update in tracking DB.`);
      return;
    }

    try {
      console.log(
        `[Tracking] Sending ${aircraft.length} aircraft to be upserted.`
      );

      await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertActiveAircraftBatch',
          positions: aircraft, // ✅ Fixes missing positions
        }),
      });
    } catch (error) {
      console.error('Failed to update tracking:', error);
    }
  }

  private async pollAircraftData(): Promise<void> {
    if (!this.currentManufacturer || !this.currentIcao24s.length) return;

    try {
      console.log(`[Tracking] Checking tracking database first...`);

      // Step 1: Check tracking database for existing aircraft
      const trackingResponse = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer: this.currentManufacturer,
          icao24s: this.currentIcao24s,
        }),
      });

      if (trackingResponse.ok) {
        const data = await trackingResponse.json();
        if (data.success && data.aircraft?.length > 0) {
          console.log(
            `[Tracking] ✅ Found ${data.aircraft.length} tracked aircraft.`
          );
          this.notifySubscribers(data.aircraft);
          return; // ✅ Stop here, no need to query OpenSky.
        }
      }

      console.log(
        `[Tracking] ❌ No active aircraft found in tracking DB. Querying OpenSky for fresh data...`
      );

      // Step 2: Break ICAO24s into batches of 200
      const CHUNK_SIZE = 200;
      const icaoChunks: string[][] = [];
      for (let i = 0; i < this.currentIcao24s.length; i += CHUNK_SIZE) {
        icaoChunks.push(this.currentIcao24s.slice(i, i + CHUNK_SIZE));
      }

      console.log(
        `[Tracking] 📡 Splitting ${this.currentIcao24s.length} ICAO24s into ${icaoChunks.length} batches`
      );

      let allAircraft: Aircraft[] = [];

      // Step 3: Process each batch sequentially
      for (let i = 0; i < icaoChunks.length; i++) {
        const chunk = icaoChunks[i];
        console.log(
          `[Tracking] 📦 Sending batch ${i + 1}/${icaoChunks.length} (${chunk.length} ICAO24s) to OpenSky`
        );

        try {
          const openSkyResponse = await fetch('/api/proxy/opensky', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              icao24s: chunk,
              time: Math.floor(Date.now() / 1000),
            }),
          });

          if (!openSkyResponse.ok) {
            console.error(
              `[Tracking] ❌ OpenSky request failed for batch ${i + 1}: ${openSkyResponse.statusText}`
            );
            continue; // Skip failed batch
          }

          const openSkyData = await openSkyResponse.json();
          if (openSkyData.success && openSkyData.data.states?.length) {
            console.log(
              `[Tracking] ✅ Batch ${i + 1}: Received ${openSkyData.data.states.length} aircraft.`
            );

            const manufacturer = this.currentManufacturer ?? '';
            const aircraftBatch = openSkyData.data.states.map(
              (state: OpenSkyStateArray) =>
                OpenSkyTransforms.toExtendedAircraft(state, manufacturer)
            );

            allAircraft = [...allAircraft, ...aircraftBatch];
          } else {
            console.log(
              `[Tracking] ❌ No active aircraft found in batch ${i + 1}`
            );
          }

          // Step 4: Add delay to avoid rate-limiting
          if (i < icaoChunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(
            `[Tracking] ❌ Network error in batch ${i + 1}:`,
            error
          );
        }
      }

      // Step 5: Save results and notify subscribers
      if (allAircraft.length > 0) {
        console.log(
          `[Tracking] ✅ Retrieved ${allAircraft.length} total aircraft from OpenSky.`
        );
        await this.updateTrackingDatabase(allAircraft);
        this.notifySubscribers(allAircraft);
      } else {
        console.log(
          `[Tracking] ❌ No active aircraft found in OpenSky. Stopping tracking.`
        );
        this.notifySubscribers([]);
      }
    } catch (error) {
      console.error('[Tracking] ❌ Failed to poll aircraft data:', error);
    }
  }

  private async processIcaoBatches(
    icao24List: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    const chunks: string[][] = [];
    for (
      let i = 0;
      i < icao24List.length;
      i += ClientTrackingService.CHUNK_SIZE
    ) {
      chunks.push(icao24List.slice(i, i + ClientTrackingService.CHUNK_SIZE));
    }

    console.log(`Processing ${chunks.length} batches of ICAO codes`);
    let allAircraft: Aircraft[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(
        `Processing batch ${i + 1}/${chunks.length} (${chunk.length} codes)`
      );

      try {
        const openSkyResponse = await fetch('/api/proxy/opensky', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            icao24s: chunk,
            time: Math.floor(Date.now() / 1000),
          }),
        });

        if (!openSkyResponse.ok) {
          console.error(
            `Failed to fetch batch ${i + 1}: ${openSkyResponse.statusText}`
          );
          continue; // 🚀 Skip this batch instead of throwing an error
        }

        const data = await openSkyResponse.json();
        if (data.success && data.data.states?.length) {
          const aircraftBatch = data.data.states.map(
            (state: OpenSkyStateArray) =>
              OpenSkyTransforms.toExtendedAircraft(state, manufacturer)
          );
          allAircraft = [...allAircraft, ...aircraftBatch];
        } else {
          console.log(`No active aircraft found for batch ${i + 1}`);
        }

        // Add delay between batches to prevent rate-limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Network error in batch ${i + 1}:`, error);
      }
    }

    return allAircraft;
  }

  public async startTracking(manufacturer: string): Promise<void> {
    try {
      this.stopTracking();

      // ✅ Validate database schema before tracking
      await fetch('/api/database/validate', { method: 'POST' });

      this.currentManufacturer = manufacturer;

      const icaoResponse = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!icaoResponse.ok) {
        throw new Error(
          `Failed to fetch ICAO codes: ${icaoResponse.statusText}`
        );
      }

      const icaoData = await icaoResponse.json();
      if (!icaoData.success || !icaoData.data.icao24List?.length) {
        console.log(`No ICAO codes found for ${manufacturer}`);
        this.notifySubscribers([]);
        return;
      }

      this.currentIcao24s = icaoData.data.icao24List;
      this.startPolling();
    } catch (error) {
      console.error('Failed to start tracking:', error);
      this.notifySubscribers([]);
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(() => this.pollAircraftData(), 30000); // Poll every 30 seconds
  }

  public stopTracking(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.currentManufacturer = null;
    this.currentIcao24s = [];
  }

  public subscribe(
    manufacturer: string,
    callback: (aircraft: Aircraft[]) => void
  ): () => void {
    const subscriber = { callback, manufacturer };
    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) {
        this.stopTracking();
      }
    };
  }

  private notifySubscribers(aircraft: Aircraft[]): void {
    this.subscribers.forEach((subscriber) => {
      if (subscriber.manufacturer === this.currentManufacturer) {
        subscriber.callback(aircraft);
      }
    });
  }

  public destroy(): void {
    this.stopTracking();
    this.subscribers.clear();
  }
}

export const clientTrackingService = ClientTrackingService.getInstance();
