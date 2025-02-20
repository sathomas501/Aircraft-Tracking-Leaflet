import { API_CONFIG } from '@/config/api';
import type { Aircraft, OpenSkyStateArray } from '@/types/base';
import { OpenSkyTransforms } from '@/utils/aircraft-transform1';
import { PollingRateLimiter } from '../services/rate-limiter';
import { RATE_LIMITS } from '@/config/rate-limits';

interface IcaoBatchResponse {
  success: boolean;
  data?: {
    states: any[];
    timestamp: number;
    meta: { total: number; requestedIcaos: number };
  };
  error?: string;
}

export class IcaoBatchService {
  private static readonly DEFAULT_BATCH_SIZE = 200; // Default batch size
  private readonly baseUrl: string;
  private readonly rateLimiter: PollingRateLimiter;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    this.rateLimiter = new PollingRateLimiter({
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
      requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
      maxWaitTime: RATE_LIMITS.AUTHENTICATED.MAX_WAIT_TIME,
      minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
      maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
      maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
      retryLimit: API_CONFIG.API.MAX_RETRY_LIMIT,
      requireAuthentication: true,
      maxConcurrentRequests: 5,
      interval: 60000, // Add appropriate interval value
      retryAfter: 1000, // Add appropriate retryAfter value
    });
  }

  private validateIcao24(icao: string): boolean {
    return /^[0-9a-f]{6}$/i.test(icao.trim());
  }

  private formatIcaos(icaos: string[]): string[] {
    return icaos
      .map((code) => code.trim().toLowerCase())
      .filter(this.validateIcao24);
  }

  private async fetchBatch(icaoBatch: string[]): Promise<IcaoBatchResponse> {
    return this.rateLimiter.schedule(async () => {
      try {
        const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s: icaoBatch }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`[IcaoBatchService] ❌ Batch fetch error:`, error);
        return {
          success: false,
          error: 'Network error during fetch',
          data: {
            states: [],
            timestamp: Date.now(),
            meta: { total: 0, requestedIcaos: icaoBatch.length },
          },
        };
      }
    });
  }

  async processBatches(
    icao24List: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    console.log(
      `[IcaoBatchService] 🔍 Processing ${icao24List.length} ICAO codes`
    );

    const validIcaos = this.formatIcaos(icao24List);
    console.log(`[IcaoBatchService] ✅ Valid ICAO codes: ${validIcaos.length}`);

    const batchSize =
      this.rateLimiter.maxAllowedBatchSize ||
      IcaoBatchService.DEFAULT_BATCH_SIZE;

    const batches: string[][] = [];
    for (let i = 0; i < validIcaos.length; i += batchSize) {
      batches.push(validIcaos.slice(i, i + batchSize));
    }

    console.log(`[IcaoBatchService] 📦 Split into ${batches.length} batches`);

    let allAircraft: Aircraft[] = [];

    for (let i = 0; i < batches.length; i++) {
      console.log(
        `[IcaoBatchService] 🚀 Fetching batch ${i + 1} / ${batches.length}`
      );

      try {
        const batchResponse = await this.fetchBatch(batches[i]);

        if (batchResponse.success && batchResponse.data?.states.length) {
          const aircraftBatch = batchResponse.data.states.map(
            (state: OpenSkyStateArray) =>
              OpenSkyTransforms.toExtendedAircraft(state, manufacturer)
          );
          allAircraft.push(...aircraftBatch);
          console.log(
            `[IcaoBatchService] ✅ Batch ${i + 1} processed ${aircraftBatch.length} aircraft`
          );
        }
      } catch (error) {
        console.error(
          `[IcaoBatchService] ❌ Error processing batch ${i + 1}`,
          error
        );
      }
    }

    return allAircraft;
  }
}
