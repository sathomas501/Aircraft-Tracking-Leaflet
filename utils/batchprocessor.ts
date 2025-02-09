// utils/batchProcessor.ts
import _ from 'lodash';
import { API_CONFIG } from '@/config/api';

interface BatchProcessorOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processBatchedRequests<T>(
  items: T[],
  batchProcessor: (batch: T[]) => Promise<any>,
  batchSize: number,
  options: BatchProcessorOptions = {}
): Promise<any[]> {
  const {
    timeout = API_CONFIG.TIMEOUT.DEFAULT,
    retries = API_CONFIG.API.DEFAULT_RETRY_LIMIT,
    retryDelay = API_CONFIG.API.MIN_POLLING_INTERVAL,
  } = options;

  if (!items.length) {
    return [];
  }

  const batches = _.chunk(items, batchSize);
  console.log(`Processing ${batches.length} batches of size ${batchSize}`);

  const processBatch = async (batch: T[], batchIndex: number) => {
    if (!batch.length) return [];

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= retries) {
      try {
        console.log(
          `Batch ${batchIndex + 1}/${batches.length}: Starting attempt ${attempts + 1}`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const result = await Promise.race([
          batchProcessor(batch),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);

        clearTimeout(timeoutId);
        console.log(
          `Batch ${batchIndex + 1}/${batches.length}: Success on attempt ${attempts + 1}`
        );
        return result;
      } catch (error) {
        attempts++;
        lastError = error as Error;
        console.error(
          `Batch ${batchIndex + 1}/${batches.length}: Attempt ${attempts} failed:`,
          error
        );

        if (attempts <= retries) {
          const nextDelay = retryDelay * attempts; // Exponential backoff
          console.log(
            `Batch ${batchIndex + 1}/${batches.length}: Retrying in ${nextDelay}ms...`
          );
          await wait(nextDelay);
        }
      }
    }

    console.error(
      `Batch ${batchIndex + 1}/${batches.length}: Failed after ${attempts} attempts`
    );
    throw lastError;
  };

  // Process batches sequentially to avoid overwhelming the API
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await processBatch(batches[i], i);
      results.push(result);
      // Add a small delay between successful batches
      if (i < batches.length - 1) {
        await wait(1000);
      }
    } catch (error) {
      console.error(`Failed to process batch ${i + 1}:`, error);
      throw error;
    }
  }

  return _.flatten(results);
}
