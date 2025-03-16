// lib/services/utils/aircraft-tracking-utils.ts
import { Model } from '@/types/base';

/**
 * Sort models by descending activeCount, then alphabetically.
 */
export const sortModels = (models: Model[]): Model[] => {
  return [...models].sort((a, b) => {
    const countA = a.activeCount ?? 0;
    const countB = b.activeCount ?? 0;
    const diff = countB - countA;
    return diff !== 0 ? diff : (a.model ?? '').localeCompare(b.model ?? '');
  });
};

/**
 * Initialize tracking for a manufacturer's aircraft
 * @param manufacturer The manufacturer name
 * @returns Response data including count of tracked aircraft
 */
export async function initializeTracking(manufacturer: string) {
  try {
    console.log(
      `[Aircraft Service] 🔄 Initializing tracking for ${manufacturer}`
    );
    const response = await fetch('/api/aircraft/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manufacturer }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize tracking: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(
      `[Aircraft Service] ✅ Successfully initialized tracking for ${data.count} aircraft`
    );
    return data;
  } catch (error) {
    console.error('[Aircraft Service] ❌ Error initializing tracking:', error);
    throw error;
  }
}

/**
 * Check current tracking status for a manufacturer
 * @param manufacturer The manufacturer name
 * @returns Status data including tracked aircraft
 */
export async function checkTrackingStatus(manufacturer: string) {
  try {
    const response = await fetch(
      `/api/tracking/tracked?manufacturer=${encodeURIComponent(manufacturer)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get tracking status: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(
      '[Aircraft Service] ❌ Error checking tracking status:',
      error
    );
    throw error;
  }
}

/**
 * Track aircraft for a specific manufacturer
 * @param manufacturer The manufacturer name
 * @returns Object containing array of live aircraft IDs
 */
export async function trackManufacturer(
  manufacturer: string
): Promise<{ liveAircraft: string[] }> {
  try {
    console.log(
      `[Aircraft Service] 🔄 Tracking aircraft for manufacturer: ${manufacturer}`
    );

    const response = await fetch(
      `/api/aircraft/tracking?manufacturer=${encodeURIComponent(manufacturer)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (!data.success || !Array.isArray(data.liveAircraft)) {
      throw new Error('Invalid API response format');
    }

    return { liveAircraft: data.liveAircraft };
  } catch (error) {
    console.error('[Aircraft Service] ❌ Failed to track manufacturer:', error);
    return { liveAircraft: [] };
  }
}
