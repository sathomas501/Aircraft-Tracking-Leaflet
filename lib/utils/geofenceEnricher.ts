// lib/utils/geofenceEnricher.ts
import type { ExtendedAircraft } from '@/types/base';

/**
 * Cache for ICAO24 lookups to reduce API calls
 */
interface IcaoCacheEntry {
  data: any;
  timestamp: number;
}

const icaoCache: Map<string, IcaoCacheEntry> = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Enriches geofence aircraft with static data from existing tracking API
 *
 * @param geofenceAircraft The aircraft data from geofence search
 * @returns Promise that resolves to enriched aircraft data
 */
export async function enrichGeofenceAircraft(
  geofenceAircraft: ExtendedAircraft[]
): Promise<ExtendedAircraft[]> {
  console.log(
    `[GeofenceEnricher] Enriching ${geofenceAircraft.length} aircraft with static data`
  );

  // Extract ICAO24 codes from the aircraft data
  const icaoCodes = geofenceAircraft
    .map((aircraft) => aircraft.ICAO24?.toLowerCase())
    .filter(Boolean) as string[];

  if (icaoCodes.length === 0) {
    console.log('[GeofenceEnricher] No valid ICAO24 codes to enrich');
    return geofenceAircraft;
  }

  // Separate cached and uncached ICAO codes
  const uncachedIcaos: string[] = [];
  const cachedData: Record<string, any> = {};
  const now = Date.now();

  // Check which ICAOs we already have in cache
  icaoCodes.forEach((icao) => {
    const cached = icaoCache.get(icao);
    if (cached && now - cached.timestamp < CACHE_TTL) {
      cachedData[icao] = cached.data;
    } else {
      uncachedIcaos.push(icao);
      // Clean up expired cache entries
      if (cached) {
        icaoCache.delete(icao);
      }
    }
  });

  console.log(
    `[GeofenceEnricher] Using ${Object.keys(cachedData).length} cached entries, looking up ${uncachedIcaos.length} from API`
  );

  // Fetch data for uncached ICAOs from the existing tracking API
  let apiResults: any[] = [];
  if (uncachedIcaos.length > 0) {
    try {
      // Use existing tracking/live API endpoint - this already does the DB lookup for us
      const response = await fetch('/api/tracking/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ICAO24s: uncachedIcaos,
          includeStatic: true, // Important: This tells the API to include DB data
          MANUFACTURER: 'geofence', // Just a label for logging
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      apiResults = data.aircraft || [];

      // Add new results to cache
      apiResults.forEach((aircraft) => {
        if (aircraft.ICAO24) {
          const icao = aircraft.ICAO24.toLowerCase();
          icaoCache.set(icao, {
            data: aircraft,
            timestamp: now,
          });
        }
      });

      console.log(
        `[GeofenceEnricher] Retrieved ${apiResults.length} aircraft from API`
      );
    } catch (error) {
      console.error(
        '[GeofenceEnricher] Error fetching aircraft from API:',
        error
      );
    }
  }

  // Convert API results to lookup map
  const apiLookup: Record<string, any> = {};
  apiResults.forEach((aircraft) => {
    if (aircraft.ICAO24) {
      apiLookup[aircraft.ICAO24.toLowerCase()] = aircraft;
    }
  });

  // Combine cached and fresh API lookups
  const combinedLookup = { ...cachedData, ...apiLookup };

  // Enrich aircraft with static data
  const enrichedAircraft = geofenceAircraft.map((aircraft) => {
    if (!aircraft.ICAO24) return aircraft;

    const icao = aircraft.ICAO24.toLowerCase();
    const staticData = combinedLookup[icao];

    if (staticData) {
      // Merge the static data with the geofence data, preserving position data
      const enriched: ExtendedAircraft = {
        ...staticData, // Start with static database data
        ...aircraft, // Override with geofence data (positions, etc.)
        // Make sure these fields are taken from static data even if geofence data has them
        MANUFACTURER:
          staticData.MANUFACTURER || aircraft.MANUFACTURER || 'Unknown',
        MODEL:
          staticData.MODEL ||
          aircraft.MODEL ||
          staticData.AIRCRAFT_TYPE ||
          'Unknown',
        AIRCRAFT_TYPE:
          staticData.AIRCRAFT_TYPE ||
          aircraft.AIRCRAFT_TYPE ||
          staticData.MODEL ||
          'Unknown',
        // Ensure type and isGovernment are set for icon rendering
        type: getAircraftType(staticData),
        isGovernment: isGovernmentAircraft(staticData),
        // Other key fields from static data to preserve
        N_NUMBER: staticData['N_NUMBER'] || aircraft['N_NUMBER'] || '',
        NAME: staticData.NAME || staticData.name || aircraft.NAME || '',
        CITY: staticData.CITY || staticData.city || aircraft.CITY || '',
        STATE: staticData.STATE || staticData.state || aircraft.STATE || '',
        OWNER_TYPE:
          staticData.OWNER_TYPE ||
          staticData.owner_type ||
          aircraft.OWNER_TYPE ||
          '',
        // Ensure these are preserved from geofence data
        latitude: aircraft.latitude,
        longitude: aircraft.longitude,
        altitude: aircraft.altitude,
        heading: aircraft.heading,
        velocity: aircraft.velocity,
        on_ground: aircraft.on_ground,
        lastSeen: aircraft.lastSeen || Date.now(),
      };

      return enriched;
    }

    // No static data found, ensure the aircraft has type and isGovernment for rendering
    return {
      ...aircraft,
      type: aircraft.type || determineTypeFromModel(aircraft.MODEL) || 'plane',
      isGovernment: aircraft.isGovernment || false,
    };
  });

  // Log some stats about the enrichment
  const enrichedCount = enrichedAircraft.filter(
    (a) => a.MANUFACTURER !== 'Unknown'
  ).length;
  console.log(
    `[GeofenceEnricher] Successfully enriched ${enrichedCount} out of ${geofenceAircraft.length} aircraft`
  );

  return enrichedAircraft;
}

/**
 * Determines aircraft type based on available information
 */
function getAircraftType(aircraft: any): string {
  // If aircraft already has a type field, use it
  if (aircraft.type && typeof aircraft.type === 'string') {
    return aircraft.type;
  }

  // Combine possible type fields for checking
  const typeString = [aircraft.AIRCRAFT_TYPE, aircraft.MODEL]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return determineTypeFromModel(typeString) || 'plane';
}

/**
 * Determines aircraft type from MODEL string
 */
function determineTypeFromModel(modelString?: string): string | null {
  if (!modelString) return null;

  const MODEL = modelString.toLowerCase();

  // Check for different aircraft types
  if (MODEL.includes('helicopter') || MODEL.includes('rotor')) {
    return 'helicopter';
  }

  if (MODEL.includes('jet') || MODEL.includes('airliner')) {
    return 'jet';
  }

  if (MODEL.includes('turboprop') || MODEL.includes('turbo prop')) {
    return 'turboprop';
  }

  if (MODEL.includes('twin')) {
    return 'twinEngine';
  }

  if (MODEL.includes('single') || MODEL.includes('piston')) {
    return 'singleEngine';
  }

  // Check for common manufacturers
  if (MODEL.includes('bell') || MODEL.includes('robinson')) {
    return 'helicopter';
  }

  if (
    MODEL.includes('boeing 7') ||
    MODEL.includes('airbus') ||
    MODEL.includes('embraer')
  ) {
    return 'jet';
  }

  // Default to "plane"
  return 'plane';
}

/**
 * Determines if an aircraft is a government aircraft
 */
function isGovernmentAircraft(aircraft: any): boolean {
  // Check owner type if available
  if (aircraft.OWNER_TYPE === '5' || aircraft.owner_type === '5') {
    return true;
  }

  // Check operator or name for government keywords
  const govKeywords = [
    'government',
    'police',
    'sheriff',
    'military',
    'air force',
    'navy',
    'coast guard',
    'federal',
  ];

  const fieldsToCheck = [aircraft.operator, aircraft.NAME, aircraft.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return govKeywords.some((keyword) => fieldsToCheck.includes(keyword));
}

/**
 * Clears the ICAO cache
 */
export function clearIcaoCache(): void {
  icaoCache.clear();
  console.log('[GeofenceEnricher] ICAO cache cleared');
}

export default {
  enrichGeofenceAircraft,
  clearIcaoCache,
};
