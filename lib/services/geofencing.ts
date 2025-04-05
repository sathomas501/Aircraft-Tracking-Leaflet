// lib/services/geofencing.ts
import { adaptGeofenceAircraft } from '../utils/geofenceAdapter';
import type { ExtendedAircraft } from '../../types/base';

/**
 * Interface for geofencing parameters
 */
export interface GeofenceParams {
  lamin: number; // Lower latitude bound (southern border)
  lamax: number; // Upper latitude bound (northern border)
  lomin: number; // Lower longitude bound (western border)
  lomax: number; // Upper longitude bound (eastern border)
}

/**
 * Interfaces for Mapbox geocoding responses
 */
interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  relevance: number;
  properties: {
    [key: string]: any;
  };
  text: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
  geometry: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  bbox?: [number, number, number, number]; // [west, south, east, north]
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface MapboxResponse {
  type: string;
  query: string[];
  features: MapboxFeature[];
  attribution: string;
}

/**
 * Search for a location using Mapbox geocoding API
 *
 * @param query Location search query (e.g., "San Francisco", "123 Main St")
 * @param limit Maximum number of results to return (default: 1)
 * @param types Optional comma-separated list of place types to search
 * @returns Promise resolving to an array of coordinates {lat, lng, name, bbox}
 */
export async function searchLocationWithMapbox(
  query: string,
  limit: number = 1,
  types?: string
): Promise<
  Array<{
    lat: number;
    lng: number;
    name: string;
    bbox?: [number, number, number, number]; // west, south, east, north
  }>
> {
  try {
    console.log(`Searching for location: "${query}" via Mapbox`);

    // Build the query string
    const params = new URLSearchParams({
      query: query,
      limit: limit.toString(),
    });

    // Add types if provided
    if (types) {
      params.append('types', types);
    }

    // Make request to your proxy endpoint
    const response = await fetch(
      `/api/proxy/mapbox-geocode?${params.toString()}`,
      {
        headers: {
          'Cache-Control': 'max-age=86400', // Cache for 24 hours
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Mapbox geocoding API error: ${response.status}`);
    }

    const data: MapboxResponse = await response.json();

    // Check if we got valid results
    if (!data.features || data.features.length === 0) {
      console.warn(`No results found for query: "${query}"`);
      return [];
    }

    // Transform Mapbox features to our standard format
    const locations = data.features.map((feature) => {
      // Mapbox returns coordinates as [longitude, latitude]
      const [lng, lat] = feature.center;

      // Validate coordinates
      if (!validateUSCoordinates(lat, lng)) {
        console.warn(
          `Location "${feature.place_name}" has coordinates outside US bounds: ${lat}, ${lng}`
        );
      }

      return {
        lat,
        lng,
        name: feature.place_name,
        // If bbox exists, return it in [west, south, east, north] format
        bbox: feature.bbox,
      };
    });

    console.log(`Found ${locations.length} locations for query "${query}"`);
    return locations;
  } catch (error) {
    console.error(`Error searching for location "${query}":`, error);
    throw new Error(
      `Failed to search for location "${query}": ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Create a geofence from a location search query
 *
 * @param query Location search query
 * @param radiusKm Radius in kilometers (default: 25km)
 * @param includeZipSearch If true, try to search as ZIP code if regular search fails
 * @returns Promise resolving to GeofenceParams or null if location not found
 */
export async function createGeofenceFromSearch(
  query: string,
  radiusKm: number = 25,
  includeZipSearch: boolean = true
): Promise<GeofenceParams | null> {
  try {
    // First try to search as a general location
    const locations = await searchLocationWithMapbox(query, 1);

    if (locations.length > 0) {
      const location = locations[0];

      // If the location has a bounding box, we can use that directly
      // This is useful for cities, neighborhoods, etc.
      if (location.bbox) {
        const [west, south, east, north] = location.bbox;

        // Expand the bounding box by the radius if needed
        // Convert radius from km to degrees (approximate)
        const EARTH_RADIUS = 6371;
        const latDelta = (radiusKm / EARTH_RADIUS) * (180 / Math.PI);
        const avgLat = (south + north) / 2;
        const lngDelta =
          ((radiusKm / EARTH_RADIUS) * (180 / Math.PI)) /
          Math.cos((avgLat * Math.PI) / 180);

        console.log(
          `Creating geofence from bounding box of "${location.name}" with ${radiusKm}km padding`
        );

        return {
          lamin: Math.max(-90, south - latDelta),
          lamax: Math.min(90, north + latDelta),
          lomin: Math.max(-180, west - lngDelta),
          lomax: Math.min(180, east + lngDelta),
        };
      }

      // If no bounding box, create a circular geofence around the point
      console.log(
        `Creating ${radiusKm}km geofence around "${location.name}" at coordinates: ${location.lat}, ${location.lng}`
      );

      return createGeofence(location.lat, location.lng, radiusKm);
    }

    // If location search failed and includeZipSearch is true,
    // check if the query might be a ZIP code
    if (includeZipSearch && /^\d{5}$/.test(query.trim())) {
      console.log(`No location found for "${query}", trying as ZIP code`);
      return await createGeofenceFromZipCode(query, radiusKm);
    }

    console.error(`No locations found for query "${query}"`);
    return null;
  } catch (error) {
    console.error(`Error creating geofence from search "${query}":`, error);

    // If the search fails and includeZipSearch is true,
    // check if the query might be a ZIP code as a fallback
    if (includeZipSearch && /^\d{5}$/.test(query.trim())) {
      console.log(
        `Error with location search for "${query}", trying as ZIP code`
      );
      try {
        return await createGeofenceFromZipCode(query, radiusKm);
      } catch (zipError) {
        console.error(
          `Zip code fallback also failed for "${query}":`,
          zipError
        );
      }
    }

    return null;
  }
}

/**
 * Get aircraft near a searched location
 *
 * @param query Location search query
 * @param radiusKm Radius in kilometers
 * @returns Promise resolving to aircraft in the area
 */
export async function getAircraftNearSearchedLocation(
  query: string,
  radiusKm: number = 25
): Promise<ExtendedAircraft[]> {
  try {
    const geofence = await createGeofenceFromSearch(query, radiusKm, true);

    if (!geofence) {
      throw new Error(`Could not create geofence for search "${query}"`);
    }

    console.log(`Created ${radiusKm}km geofence for search "${query}"`);
    return await fetchAircraftInGeofence(geofence);
  } catch (error) {
    console.error(`Error getting aircraft near search "${query}":`, error);
    return [];
  }
}

/**
 * Get location suggestions from search query
 *
 * @param query Location search query
 * @param limit Maximum number of suggestions to return (default: 5)
 * @returns Promise resolving to array of location suggestions
 */
export async function getLocationSuggestions(
  query: string,
  limit: number = 5
): Promise<
  Array<{
    name: string;
    lat: number;
    lng: number;
    placeType: string;
  }>
> {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Get location results with a higher limit for better suggestions
    const locations = await searchLocationWithMapbox(
      query,
      Math.max(5, limit),
      // Include these specific types for better suggestions
      'place,postcode,address,poi,neighborhood,region,locality'
    );

    // Transform to a simpler suggestion format
    return locations.slice(0, limit).map((location) => ({
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      // Extract the first place type from the full Mapbox response
      placeType: location.name.split(',')[0],
    }));
  } catch (error) {
    console.error(`Error getting location suggestions for "${query}":`, error);
    return [];
  }
}

/**
 * Validates that coordinates are within expected US bounds
 */
function validateUSCoordinates(lat: number, lng: number): boolean {
  // Basic validation for coordinates in the continental US and Alaska/Hawaii
  // Continental US, Alaska, and Hawaii approximate boundaries
  const isValidLat = lat >= 20.0 && lat <= 71.0; // Covers southern Hawaii to northern Alaska
  const isValidLng = lng >= -180.0 && lng <= -66.0; // From western Alaska to eastern coast

  const isValid = isValidLat && isValidLng;

  if (!isValid) {
    console.error(`Invalid US coordinates detected: lat ${lat}, lng ${lng}`);
    console.error('These coordinates are outside the US bounds.');
  }

  return isValid;
}

/**
 * Converts a US ZIP code to latitude and longitude coordinates
 *
 * @param zipCode The US ZIP code to convert (5 digits)
 * @returns Promise that resolves to {lat: number, lng: number} or null if not found
 */
export async function zipCodeToCoordinates(
  zipCode: string
): Promise<{ lat: number; lng: number }> {
  try {
    // Ensure zip code is in the correct format (5 digits)
    const formattedZip = zipCode.replace(/[^0-9]/g, '').substring(0, 5);

    if (formattedZip.length !== 5) {
      throw new Error('ZIP code must be 5 digits');
    }

    console.log(`Fetching coordinates for ZIP code: ${formattedZip}`);

    // Use consistent query parameter (zip instead of place)
    const response = await fetch(`/api/proxy/geocode?zip=${formattedZip}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store', // Prevent caching
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if we got valid results
    if (
      data.result?.addressMatches &&
      data.result.addressMatches.length > 0 &&
      data.result.addressMatches[0].coordinates
    ) {
      const coordinates = data.result.addressMatches[0].coordinates;
      const lat = coordinates.y;
      const lng = coordinates.x;

      // Validate coordinates
      if (!validateUSCoordinates(lat, lng)) {
        throw new Error(
          `Invalid coordinates returned for ZIP ${formattedZip}: ${lat}, ${lng}`
        );
      }

      console.log(
        `Found valid coordinates for ZIP ${formattedZip}: ${lat}, ${lng}`
      );

      return {
        lat,
        lng,
      };
    }

    // If no matches found
    throw new Error(`No coordinates found for ZIP code ${zipCode}`);
  } catch (error) {
    console.error(
      `Error converting ZIP code ${zipCode} to coordinates:`,
      error
    );
    // Better to throw so the caller knows what happened
    throw new Error(
      `Failed to get coordinates for ZIP ${zipCode}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Creates a geofence bounding box around a central point with radius in km
 *
 * @param centerLat Central latitude point
 * @param centerLng Central longitude point
 * @param radiusKm Radius in kilometers (default: 25km)
 * @returns GeofenceParams object with bounding box coordinates
 */
export function createGeofence(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 10
): GeofenceParams {
  // Validate input coordinates
  if (!validateUSCoordinates(centerLat, centerLng)) {
    console.warn(
      `Creating geofence with potentially invalid coordinates: ${centerLat}, ${centerLng}`
    );
  }

  // Earth's radius in km
  const EARTH_RADIUS = 6371;

  // Convert radius from km to degrees (approximate)
  // 1 degree of latitude is approximately 111km
  const latDelta = (radiusKm / EARTH_RADIUS) * (180 / Math.PI);

  // Longitude degrees vary based on latitude
  // The width of 1 degree of longitude decreases as you move away from the equator
  const lngDelta =
    ((radiusKm / EARTH_RADIUS) * (180 / Math.PI)) /
    Math.cos((centerLat * Math.PI) / 180);

  // Calculate the geofence
  const geofence = {
    lamin: Math.max(-90, centerLat - latDelta),
    lamax: Math.min(90, centerLat + latDelta),
    lomin: Math.max(-180, centerLng - lngDelta),
    lomax: Math.min(180, centerLng + lngDelta),
  };

  // Log the calculated geofence for debugging
  console.log(
    `Created geofence: lat [${geofence.lamin}, ${geofence.lamax}], lng [${geofence.lomin}, ${geofence.lomax}]`
  );

  return geofence;
}

/**
 * Creates a geofence from a ZIP code with a specified radius
 *
 * @param zipCode US ZIP code
 * @param radiusKm Radius in kilometers (default: 10km)
 * @returns Promise resolving to GeofenceParams or null if ZIP code not found
 */
export async function createGeofenceFromZipCode(
  zipCode: string,
  radiusKm: number = 25
): Promise<GeofenceParams | null> {
  try {
    const coordinates = await zipCodeToCoordinates(zipCode);

    // Double-check coordinates are valid
    if (
      !coordinates ||
      !validateUSCoordinates(coordinates.lat, coordinates.lng)
    ) {
      console.error(`Invalid or missing coordinates for ZIP ${zipCode}`);
      return null;
    }

    console.log(
      `Creating ${radiusKm}km geofence around ZIP ${zipCode} at coordinates: ${coordinates.lat}, ${coordinates.lng}`
    );
    return createGeofence(coordinates.lat, coordinates.lng, radiusKm);
  } catch (error) {
    console.error(`Error creating geofence from ZIP ${zipCode}:`, error);
    return null;
  }
}

/**
 * Fetches aircraft within a specified geofence area
 *
 * @param geofence Geofence parameters defining the bounding box
 * @returns Promise resolving to an array of aircraft within the geofence
 */
export async function fetchAircraftInGeofence(
  geofence: GeofenceParams
): Promise<ExtendedAircraft[]> {
  try {
    console.log(`[Geofencing] Fetching aircraft in geofence: 
      Lat: ${geofence.lamin} to ${geofence.lamax}, 
      Lng: ${geofence.lomin} to ${geofence.lomax}`);

    // Create API URL with geofence parameters for your proxy endpoint
    const response = await fetch('/api/proxy/opensky', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        geofence,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Error fetching geofenced aircraft: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Check if the format matches what we expect
    if (!data.success || !data.data || !Array.isArray(data.data.states)) {
      console.warn(
        '[Geofencing] Unexpected response format from OpenSky proxy:',
        data
      );
      return [];
    }

    console.log(
      `[Geofencing] Retrieved ${data.data.states.length} aircraft within geofence`
    );

    // Add some base properties to each aircraft
    const rawAircraft = data.data.states.map((aircraft: any) => ({
      ...aircraft,
      // Ensure core fields exist
      ICAO24: aircraft.ICAO24 || aircraft.transponder || '',
      lastSeen: Date.now(),
    }));

    if (rawAircraft.length > 0) {
      console.log('[Debug] Raw aircraft data sample:', rawAircraft[0]);
    }

    // Use the adapter to transform the raw aircraft data to ExtendedAircraft format
    const adaptedAircraft = adaptGeofenceAircraft(rawAircraft);

    // Debug adapted data
    if (adaptedAircraft.length > 0) {
      console.log('[Debug] Adapted aircraft sample:', adaptedAircraft[0]);
    }

    console.log(
      `[Geofencing] Transformed ${adaptedAircraft.length} aircraft to ExtendedAircraft format`
    );

    if (adaptedAircraft.length > 0) {
      console.log(
        '[Geofencing] Sample transformed aircraft:',
        adaptedAircraft[0]
      );
    }

    return adaptedAircraft;
  } catch (error) {
    console.error('[Geofencing] Error fetching aircraft in geofence:', error);
    return [];
  }
}

/**
 * Get aircraft near a ZIP code
 *
 * @param zipCode US ZIP code
 * @param radiusKm Radius in kilometers
 * @returns Promise resolving to aircraft in the area
 */
export async function getAircraftNearZipCode(
  zipCode: string,
  radiusKm: number = 25
): Promise<ExtendedAircraft[]> {
  try {
    const geofence = await createGeofenceFromZipCode(zipCode, radiusKm);

    if (!geofence) {
      throw new Error(`Could not create geofence for ZIP code ${zipCode}`);
    }

    console.log(`Created ${radiusKm}km geofence around ZIP ${zipCode}`);
    return await fetchAircraftInGeofence(geofence);
  } catch (error) {
    console.error(`Error getting aircraft near ZIP ${zipCode}:`, error);
    return [];
  }
}

/**
 * Get aircraft near a specific location
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param radiusKm Radius in kilometers
 * @returns Promise resolving to aircraft in the area
 */
export async function getAircraftNearLocation(
  lat: number,
  lng: number,
  radiusKm: number = 25
): Promise<ExtendedAircraft[]> {
  try {
    // Validate coordinates
    if (!validateUSCoordinates(lat, lng)) {
      console.warn(
        `Potentially invalid coordinates for location search: ${lat}, ${lng}`
      );
    }

    const geofence = createGeofence(lat, lng, radiusKm);
    console.log(
      `Created ${radiusKm}km geofence around location (${lat}, ${lng})`
    );
    return await fetchAircraftInGeofence(geofence);
  } catch (error) {
    console.error(
      `Error getting aircraft near location (${lat}, ${lng}):`,
      error
    );
    return [];
  }
}

/**
 * Calculates distance between two coordinates in kilometers
 *
 * @param lat1 First latitude
 * @param lng1 First longitude
 * @param lat2 Second latitude
 * @param lng2 Second longitude
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Haversine formula
  const EARTH_RADIUS = 6371; // km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}
