// components/aircraft/selector/services/aircraftService.ts
import { SelectOption } from '@/types/base';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';

const REQUEST_CONSTANTS = {
  FETCH_TIMEOUT: 8000, // 8 seconds
  MAX_RETRIES: 2, // Maximum number of retry attempts
  MIN_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 5000, // 5 seconds
} as const;

export interface Model {
  model: string;
  label: string;
  activeCount?: number;
  count?: number;
}

const manufacturersRateLimiter = new PollingRateLimiter({
  requestsPerMinute: 30,
  requestsPerDay: 1000,
  maxWaitTime: 10000,
  minPollingInterval: 1000,
  maxPollingInterval: 5000,
  maxBatchSize: 50,
  retryLimit: REQUEST_CONSTANTS.MAX_RETRIES,
  requireAuthentication: false,
  maxConcurrentRequests: 3,
});

async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  timeout: number = REQUEST_CONSTANTS.FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

async function handleFetchWithRetry(
  url: string,
  options: RequestInit,
  retryCount: number = 0
): Promise<Response> {
  try {
    const response = await fetchWithTimeout(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! Status: ${response.status}, Body: ${errorText}`
      );
    }
    return response;
  } catch (error) {
    console.error(
      `[Aircraft Service] ❌ Attempt ${retryCount + 1} failed:`,
      error
    );

    if (retryCount < REQUEST_CONSTANTS.MAX_RETRIES) {
      const delay = Math.min(
        Math.pow(2, retryCount) * REQUEST_CONSTANTS.MIN_RETRY_DELAY,
        REQUEST_CONSTANTS.MAX_RETRY_DELAY
      );

      console.log(`[Aircraft Service] 🔄 Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return handleFetchWithRetry(url, options, retryCount + 1);
    }

    throw error;
  }
}

export async function fetchManufacturers(): Promise<SelectOption[]> {
  try {
    console.log('[Aircraft Service] 🔄 Starting manufacturers fetch');

    return await manufacturersRateLimiter.schedule(async () => {
      const response = await handleFetchWithRetry(
        '/api/aircraft/manufacturers',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (
        !data.success ||
        !data.manufacturers ||
        !Array.isArray(data.manufacturers)
      ) {
        console.error('[Aircraft Service] ❌ Invalid response format:', data);
        throw new Error('Invalid API response format');
      }

      console.log(
        `[Aircraft Service] ✅ Loaded ${data.manufacturers.length} manufacturers`
      );
      return data.manufacturers;
    });
  } catch (error) {
    console.error(
      '[Aircraft Service] ❌ Failed to fetch manufacturers:',
      error
    );
    errorHandler.handleError(
      ErrorType.OPENSKY_SERVICE,
      error instanceof Error
        ? error
        : new Error('Failed to fetch manufacturers')
    );
    return [];
  }
}

export async function trackManufacturer(
  manufacturer: string
): Promise<{ liveAircraft: string[] }> {
  try {
    console.log(
      `[Aircraft Service] 🔄 Tracking aircraft for manufacturer: ${manufacturer}`
    );

    const response = await handleFetchWithRetry(
      `/api/aircraft/track?manufacturer=${encodeURIComponent(manufacturer)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (!data.success || !Array.isArray(data.liveAircraft)) {
      console.error('[Aircraft Service] ❌ Invalid response format:', data);
      throw new Error('Invalid API response format');
    }

    console.log(
      `[Aircraft Service] ✅ Found ${data.liveAircraft.length} active aircraft`
    );
    return { liveAircraft: data.liveAircraft };
  } catch (error) {
    console.error('[Aircraft Service] ❌ Failed to track manufacturer:', error);
    errorHandler.handleError(
      ErrorType.OPENSKY_SERVICE,
      error instanceof Error ? error : new Error('Failed to track manufacturer')
    );
    return { liveAircraft: [] };
  }
}
