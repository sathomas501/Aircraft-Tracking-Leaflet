// lib/services/utils/aircraft-tracking-utils.ts
export async function trackManufacturer(
  manufacturer: string
): Promise<{ liveAircraft: string[] }> {
  try {
    console.log(
      `[Aircraft Service] 🔄 Tracking aircraft for manufacturer: ${manufacturer}`
    );

    const response = await fetch(
      `/api/aircraft/track?manufacturer=${encodeURIComponent(manufacturer)}`,
      {
        method: 'GET',
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
