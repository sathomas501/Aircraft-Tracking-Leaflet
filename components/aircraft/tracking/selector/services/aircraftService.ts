// components/aircraft/selector/services/aircraftService.ts
import { Aircraft, Model } from '@/types/base';
import { useFetchManufacturers } from '../../../../../hooks/useFetchManufactures';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { getCachedIcao24s } from '../../../../../lib/services/managers/aircraft-cache';

const REQUEST_CONSTANTS = {
  FETCH_TIMEOUT: 8000, // 8 seconds
  MAX_RETRIES: 2, // Maximum number of retry attempts
  MIN_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 5000, // 5 seconds
} as const;

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
  interval: 60000, // Add appropriate interval value
  retryAfter: 1000, // Add appropriate retryAfter value
});

export async function getAircraftIcao24s(manufacturer: string) {
  return await getCachedIcao24s(manufacturer);
}

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

export async function fetchAircraftByManufacturer(
  manufacturer: string | null
): Promise<Aircraft[]> {
  if (!manufacturer) {
    console.warn('⚠️ No manufacturer selected, returning empty aircraft list.');
    return []; // ✅ Ensure return even in this case
  }

  try {
    const response = await fetch('/api/aircraft/manufacturer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer }),
    });

    if (!response.ok) {
      throw new Error(`❌ Failed to fetch aircraft: ${response.statusText}`);
    }

    const data = await response.json();

    return data.aircraft || []; // ✅ Always return an array
  } catch (error) {
    console.error(`[fetchAircraftByManufacturer] ❌ Error:`, error);
    return []; // ✅ Ensure function always returns something
  }
}

export const getManufacturers = () => {
  const { manufacturers } = useFetchManufacturers();
  return manufacturers;
};

export async function fetchModels(manufacturer: string): Promise<Model[]> {
  try {
    if (!manufacturer) {
      console.warn('[Aircraft Service] ⚠️ No manufacturer provided');
      return [];
    }

    console.log('[Aircraft Service] 🔄 Fetching models for:', manufacturer);
    const encodedManufacturer = encodeURIComponent(manufacturer.trim());
    const response = await fetch('/api/aircraft/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer }),
    });

    // Handle HTTP errors
    if (!response.ok) {
      console.error(
        `[Aircraft Service] ❌ API responded with ${response.status}: ${response.statusText}`
      );
      return [];
    }

    // Read response as text first for debugging
    const responseText = await response.text();
    console.log(
      '[Aircraft Service] 📦 Raw response text:',
      responseText.substring(0, 300) + '...'
    );

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Aircraft Service] ❌ Failed to parse JSON:', parseError);
      return [];
    }

    // Validate response format
    if (
      !data ||
      typeof data !== 'object' ||
      !data.success ||
      !Array.isArray(data.data)
    ) {
      console.warn('[Aircraft Service] ⚠️ Invalid response format:', data);
      return [];
    }

    console.log(
      '[Aircraft Service] ✅ Received models:',
      data.data.slice(0, 2)
    );

    // Ensure every model has valid values before mapping
    return data.data.map((model: any) => ({
      model: model?.model || 'Unknown Model',
      manufacturer: model?.manufacturer || manufacturer,
      count: typeof model?.count === 'number' ? model.count : 0,
      totalCount:
        typeof model?.totalCount === 'number'
          ? model.totalCount
          : model?.count || 0,
      activeCount:
        typeof model?.activeCount === 'number' ? model.activeCount : 0,
      inactiveCount: Math.max(
        typeof model?.inactiveCount === 'number' ? model.inactiveCount : 0,
        (typeof model?.totalCount === 'number'
          ? model.totalCount
          : model?.count || 0) -
          (typeof model?.activeCount === 'number' ? model.activeCount : 0)
      ),
      label: `${model?.model || 'Unknown Model'} (${model?.activeCount || 0} active, ${Math.max(
        (typeof model?.totalCount === 'number'
          ? model.totalCount
          : model?.count || 0) -
          (typeof model?.activeCount === 'number' ? model.activeCount : 0),
        0
      )} inactive)`,
    }));
  } catch (error) {
    console.error(
      '[Aircraft Service] ❌ Unexpected error fetching models:',
      error
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (!data.success || !Array.isArray(data.liveAircraft)) {
      console.error('[Aircraft Service] ❌ Invalid response format:', data);
      return { liveAircraft: [] };
    }

    console.log(
      `[Aircraft Service] ✅ Found ${data.liveAircraft.length} active aircraft`
    );
    return { liveAircraft: data.liveAircraft };
  } catch (error) {
    console.error('[Aircraft Service] ❌ Failed to track manufacturer:', error);
    return { liveAircraft: [] };
  }
}
