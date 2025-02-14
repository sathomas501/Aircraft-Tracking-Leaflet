// lib/utils/icao-batch-processor.ts
import type { Aircraft, OpenSkyStateArray } from '../types/base';
import { OpenSkyTransforms } from '@/utils/aircraft-transform1';

export class IcaoBatchProcessor {
  private readonly CHUNK_SIZE = 200;

  constructor() {
    this.processIcaoBatches = this.processIcaoBatches.bind(this); // ✅ Bind method to 'this'
  }

  public async processIcaoBatches(
    icao24s: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    if (!icao24s || icao24s.length === 0) {
      console.warn('[IcaoBatchProcessor] No ICAOs provided.');
      return [];
    }

    const chunks: string[][] = [];
    for (let i = 0; i < icao24s.length; i += this.CHUNK_SIZE) {
      chunks.push(icao24s.slice(i, i + this.CHUNK_SIZE));
    }

    console.log(
      `[IcaoBatchProcessor] Processing ${chunks.length} ICAO batches`
    );

    let allAircraft: Aircraft[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(
        `[IcaoBatchProcessor] Fetching batch ${i + 1} of ${chunks.length}`
      );

      try {
        const response = await fetch('/api/proxy/opensky', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            icao24s: chunk,
            time: Math.floor(Date.now() / 1000),
          }),
        });

        if (!response.ok) {
          console.error(
            `[IcaoBatchProcessor] ❌ Failed batch ${i + 1}: ${response.statusText}`
          );
          continue;
        }

        const data = await response.json();
        if (data.success && data.data.states?.length) {
          const aircraftBatch = data.data.states.map(
            (state: OpenSkyStateArray) =>
              OpenSkyTransforms.toExtendedAircraft(state, manufacturer)
          );

          allAircraft = [...allAircraft, ...aircraftBatch];
          console.log(
            `[IcaoBatchProcessor] ✅ Batch ${i + 1} processed ${aircraftBatch.length} aircraft`
          );
        } else {
          console.log(
            `[IcaoBatchProcessor] ❌ No active aircraft found in batch ${i + 1}`
          );
        }

        // Add delay between batches to prevent rate-limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(
          `[IcaoBatchProcessor] ❌ Network error in batch ${i + 1}:`,
          error
        );
      }
    }

    return allAircraft;
  }
}
