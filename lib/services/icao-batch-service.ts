// services/icao-batch-service.ts
import { API_CONFIG } from '@/config/api';

interface IcaoBatchResponse {
  success: boolean;
  data?: {
    states: any[];
    timestamp: number;
    meta: {
      total: number;
      requestedIcaos: number;
    };
  };
  error?: string;
}

export class IcaoBatchService {
  private static readonly BATCH_SIZE = 200;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private validateIcao24(icao: string): boolean {
    return /^[0-9a-f]{6}$/.test(icao.toLowerCase().trim());
  }

  private formatIcaos(icaos: string[]): string[] {
    return icaos
      .map((code) => code.toLowerCase().trim())
      .filter(this.validateIcao24);
  }

  private async fetchBatch(icaoBatch: string[]): Promise<IcaoBatchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ icao24s: icaoBatch }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`[IcaoBatchService] Batch fetch error:`, error);
      throw error;
    }
  }

  async processBatches(icao24List: string[]): Promise<IcaoBatchResponse[]> {
    console.log(
      `[IcaoBatchService] Processing ${icao24List.length} ICAO codes`
    );

    // Format and validate all ICAOs first
    const validIcaos = this.formatIcaos(icao24List);
    console.log(`[IcaoBatchService] Valid ICAO codes: ${validIcaos.length}`);

    const batches: string[][] = [];
    for (let i = 0; i < validIcaos.length; i += IcaoBatchService.BATCH_SIZE) {
      batches.push(validIcaos.slice(i, i + IcaoBatchService.BATCH_SIZE));
    }

    console.log(`[IcaoBatchService] Split into ${batches.length} batches`);

    const results: IcaoBatchResponse[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `[IcaoBatchService] Processing batch ${i + 1}/${batches.length} (${batch.length} codes)`
      );

      try {
        const batchResult = await this.fetchBatch(batch);
        results.push(batchResult);

        // Add delay between batches to prevent rate limiting
        if (i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(
          `[IcaoBatchService] Error processing batch ${i + 1}:`,
          error
        );

        // Add failed batch info to results
        results.push({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error processing batch',
          data: {
            states: [],
            timestamp: Date.now(),
            meta: {
              total: 0,
              requestedIcaos: batch.length,
            },
          },
        });

        // Add longer delay after error
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  // Helper method to combine all batch responses into a single response
  combineResponses(responses: IcaoBatchResponse[]): IcaoBatchResponse {
    const successfulResponses = responses.filter((r) => r.success && r.data);

    if (successfulResponses.length === 0) {
      return {
        success: false,
        error: 'No successful batch responses',
        data: {
          states: [],
          timestamp: Date.now(),
          meta: {
            total: 0,
            requestedIcaos: 0,
          },
        },
      };
    }

    const combinedStates = successfulResponses.reduce((acc, curr) => {
      return acc.concat(curr.data?.states || []);
    }, [] as any[]);

    const totalRequested = responses.reduce((acc, curr) => {
      return acc + (curr.data?.meta.requestedIcaos || 0);
    }, 0);

    return {
      success: true,
      data: {
        states: combinedStates,
        timestamp: Date.now(),
        meta: {
          total: combinedStates.length,
          requestedIcaos: totalRequested,
        },
      },
    };
  }
}
