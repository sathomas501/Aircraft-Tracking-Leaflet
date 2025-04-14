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
    return diff !== 0 ? diff : (a.MODEL ?? '').localeCompare(b.MODEL ?? '');
  });
};

/**
 * Initialize tracking for a MANUFACTURER's aircraft
 * @param MANUFACTURER The MANUFACTURER name
 * @returns Response data including count of tracked aircraft
 */
export async function initializeTracking(MANUFACTURER: string) {
  try {
    console.log(
      `[Aircraft Service] 🔄 Initializing tracking for ${MANUFACTURER}`
    );
    const response = await fetch('/api/aircraft/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ MANUFACTURER }),
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
 * Check current tracking status for a MANUFACTURER
 * @param MANUFACTURER The MANUFACTURER name
 * @returns Status data including tracked aircraft
 */
export async function checkTrackingStatus(MANUFACTURER: string) {
  try {
    const response = await fetch(
      `/api/tracking/tracked?MANUFACTURER=${encodeURIComponent(MANUFACTURER)}`
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
 * Track aircraft for a specific MANUFACTURER
 * @param MANUFACTURER The MANUFACTURER name
 * @returns Object containing array of live aircraft IDs
 */
export async function trackManufacturer(
  MANUFACTURER: string
): Promise<{ liveAircraft: string[] }> {
  try {
    console.log(
      `[Aircraft Service] 🔄 Tracking aircraft for MANUFACTURER: ${MANUFACTURER}`
    );

    const response = await fetch(
      `/api/aircraft/tracking?MANUFACTURER=${encodeURIComponent(MANUFACTURER)}`,
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
    console.error('[Aircraft Service] ❌ Failed to track MANUFACTURER:', error);
    return { liveAircraft: [] };
  }
}
