/**
 * Get a list of `icao24` codes for a specific manufacturer.
 * @param manufacturer - The manufacturer name to filter by.
 * @param model - (Optional) The model name to filter by.
 */
export async function getIcao24s(
  manufacturer: string,
  model?: string
): Promise<string[]> {
  try {
    const response = await fetch(
      `/api/db/activeAircraft?action=getIcao24s&manufacturer=${encodeURIComponent(manufacturer)}&model=${encodeURIComponent(model || '')}`
    );
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.icao24s || [];
  } catch (error) {
    console.error('Error fetching ICAO24s:', error);
    return [];
  }
}

export async function getCombinedAircraftData(
  manufacturer: string
): Promise<any[]> {
  try {
    const response = await fetch(
      `/api/db/activeAircraft?action=getCombinedAircraftData&manufacturer=${encodeURIComponent(manufacturer)}`
    );
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.combinedAircraftData || [];
  } catch (error) {
    console.error('Error fetching combined aircraft data:', error);
    return [];
  }
}
