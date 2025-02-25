// lib/services/icao24Cache.ts
const cachedIcao24s = new Map<string, string[]>(); // Store ICAO24s by manufacturer
const pendingRequests = new Map<string, Promise<string[]>>(); // Prevent duplicate requests

export async function fetchIcao24s(manufacturer: string): Promise<string[]> {
  if (!manufacturer) return [];

  // ✅ Check if we have cached ICAO24s
  if (cachedIcao24s.has(manufacturer)) {
    console.log(`[ICAO24Cache] ✅ Using cached ICAO24s for ${manufacturer}`);
    return cachedIcao24s.get(manufacturer) || [];
  }

  // ✅ Prevent multiple simultaneous requests for the same manufacturer
  if (pendingRequests.has(manufacturer)) {
    console.log(
      `[ICAO24Cache] 🚧 Request already in progress for ${manufacturer}, waiting...`
    );
    return pendingRequests.get(manufacturer)!;
  }

  // ✅ Fetch ICAO24s and cache the result
  const fetchPromise = fetch('/api/aircraft/icao24s', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manufacturer }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch ICAO24s for ${manufacturer}`);
      }
      const data = await response.json();
      const icao24List =
        data.success && data.data?.icao24List ? data.data.icao24List : [];
      cachedIcao24s.set(manufacturer, icao24List); // Cache the response
      return icao24List;
    })
    .catch((error) => {
      console.error(
        `[ICAO24Cache] ❌ Error fetching ICAO24s for ${manufacturer}:`,
        error
      );
      return [];
    })
    .finally(() => {
      pendingRequests.delete(manufacturer); // Remove from pending requests
    });

  // Store pending request
  pendingRequests.set(manufacturer, fetchPromise);

  return fetchPromise;
}
