// lib/services/geofencing.ts
import { adaptGeofenceAircraft } from '../utils/geofenceAdapter';
import type { ExtendedAircraft, Feature } from '../../types/base';

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
  types?: string,
  countryCode?: string
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

    // Add country restriction if provided
    if (countryCode) {
      params.append('country', countryCode);
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
      if (!validateCoordinates(lat, lng)) {
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
export async function createGeofenceFromPostalCode(
  postalCode: string,
  countryCode: string = 'us',
  radiusKm: number = 25
): Promise<GeofenceParams | null> {
  try {
    const coordinates = await postalCodeToCoordinates(postalCode, countryCode);

    // Double-check coordinates are valid
    if (
      !coordinates ||
      !validateCoordinates(coordinates.lat, coordinates.lng)
    ) {
      console.error(
        `Invalid or missing coordinates for postal code ${postalCode} in ${countryCode}`
      );
      return null;
    }

    console.log(
      `Creating ${radiusKm}km geofence around postal code ${postalCode} (${countryCode}) at coordinates: ${coordinates.lat}, ${coordinates.lng}`
    );
    return createGeofence(coordinates.lat, coordinates.lng, radiusKm);
  } catch (error) {
    console.error(
      `Error creating geofence from postal code ${postalCode}:`,
      error
    );
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
    // First check if the query looks like coordinates
    const coordsRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
    const coordsMatch = query.match(coordsRegex);

    if (coordsMatch) {
      // It's coordinates, parse them
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[3]);

      // Create geofence directly from coordinates
      const geofence = createGeofence(lat, lng, radiusKm);
      console.log(
        `Created ${radiusKm}km geofence for coordinates (${lat}, ${lng})`
      );
      return await fetchAircraftInGeofence(geofence);
    }

    // Try using Mapbox for global address search
    try {
      const locations = await searchLocationWithMapbox(
        query,
        1,
        'place,postcode,address,poi,neighborhood,region,locality'
      );

      if (locations && locations.length > 0) {
        // We got a valid location from Mapbox
        const location = locations[0];
        const geofence = createGeofence(location.lat, location.lng, radiusKm);
        console.log(
          `Created ${radiusKm}km geofence for location "${location.name}"`
        );
        return await fetchAircraftInGeofence(geofence);
      }
    } catch (mapboxError) {
      console.warn(`Mapbox search failed for query "${query}":`, mapboxError);
      // Continue to next method if Mapbox fails
    }

    // Fallback to postal code lookup if everything else fails
    try {
      const geofence = await createGeofenceFromPostalCode(
        query,
        'us',
        radiusKm
      );

      if (geofence) {
        console.log(
          `Created ${radiusKm}km geofence for postal code "${query}"`
        );
        return await fetchAircraftInGeofence(geofence);
      }
    } catch (postalError) {
      console.warn(
        `Postal code lookup failed for query "${query}":`,
        postalError
      );
    }

    console.error(`All location lookup methods failed for query: "${query}"`);
    return [];
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

export async function getCoordinatesFromQuery(
  query: string
): Promise<{ lat: number; lng: number; name: string } | null> {
  try {
    // First check if the query looks like coordinates
    const coordsRegex = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
    const coordsMatch = query.match(coordsRegex);

    if (coordsMatch) {
      // It's coordinates, parse them
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[3]);

      if (validateCoordinates(lat, lng)) {
        return { lat, lng, name: `${lat}, ${lng}` };
      }
    }

    // Use Mapbox for general global addresses (most robust)
    const locations = await searchLocationWithMapbox(
      query,
      1,
      'place,postcode,address,poi,neighborhood,region,locality'
    );

    if (locations && locations.length > 0) {
      return {
        lat: locations[0].lat,
        lng: locations[0].lng,
        name: locations[0].name,
      };
    }

    console.error(`Could not resolve coordinates for query: "${query}"`);
    return null;
  } catch (error) {
    console.error(`Error getting coordinates from query "${query}":`, error);
    return null;
  }
}

/**
 * Validates that coordinates are within global bounds
 */
function validateCoordinates(lat: number, lng: number): boolean {
  // Check for NaN or undefined values
  if (isNaN(lat) || isNaN(lng)) {
    console.error(
      `Invalid coordinates: lat or lng is NaN - lat: ${lat}, lng: ${lng}`
    );
    return false;
  }

  // Basic validation for coordinates globally
  const isValidLat = lat >= -90.0 && lat <= 90.0;
  const isValidLng = lng >= -180.0 && lng <= 180.0;

  const isValid = isValidLat && isValidLng;

  if (!isValid) {
    console.error(`Invalid coordinates detected: lat ${lat}, lng ${lng}`);
    if (!isValidLat) console.error(`Latitude must be between -90 and 90`);
    if (!isValidLng) console.error(`Longitude must be between -180 and 180`);
  }

  return isValid;
}

/**
 * Converts a Postal code to latitude and longitude coordinates
 *
 * @returns Promise that resolves to {lat: number, lng: number} or null if not found
 */
export async function postalCodeToCoordinates(
  postalCode: string,
  countryCode: string = 'us'
): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log(
      `Fetching coordinates for Postal code: ${postalCode} in ${countryCode}`
    );

    // Add country code to query parameters
    const response = await fetch(
      `/api/proxy/geocode?zip=${postalCode}&country=${countryCode}`,
      {
        headers: {
          'Cache-Control': 'no-cache, no-store', // Prevent caching
        },
      }
    );

    // Better error handling with response details
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Geocoding API error (${response.status}): ${errorText}`);
      return null; // Return null instead of throwing to allow fallbacks
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

      return {
        lat,
        lng,
      };
    }

    // If no matches found
    console.warn(`No coordinates found for Postal code ${postalCode}`);
    return null;
  } catch (error) {
    console.error(
      `Error converting Postal code ${postalCode} to coordinates:`,
      error
    );
    return null; // Return null to allow fallbacks
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
  if (!validateCoordinates(centerLat, centerLng)) {
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
export async function getAircraftNearPostalCode(
  postalCode: string,
  radiusKm: number = 25
): Promise<ExtendedAircraft[]> {
  try {
    const geofence = await createGeofenceFromPostalCode(
      postalCode,
      'us',
      radiusKm
    );

    if (!geofence) {
      throw new Error(
        `Could not create geofence for Postal Code ${postalCode}`
      );
    }

    console.log(
      `Created ${radiusKm}km geofence around Postal Code ${postalCode}`
    );
    return await fetchAircraftInGeofence(geofence);
  } catch (error) {
    console.error(
      `Error getting aircraft near Postal Code ${postalCode}:`,
      error
    );
    return [];
  }
}

/**
 * Gets a human-readable location name from coordinates using Mapbox reverse geocoding
 *
 * @param lat - Latitude (decimal degrees)
 * @param lng - Longitude (decimal degrees)
 * @returns Promise resolving to a location name or coordinates string if not found
 */
const getLocationNameFromCoordinates = async (
  lat: number,
  lng: number
): Promise<string | null> => {
  try {
    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates:', lat, lng);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    // VERY IMPORTANT: Format coordinates correctly for Mapbox
    // Longitude first, no space after comma
    const coordsQuery = `${lng},${lat}`;

    // Use the exact same query format that worked in your REST tests
    const url = `/api/proxy/mapbox-geocode?query=${encodeURIComponent(coordsQuery)}`;
    console.log(`Making geocoding request: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('API response features:', data.features?.length || 0);

    // Check if we got results
    if (data.features && data.features.length > 0) {
      // Try to extract city and region
      const feature = data.features[0];

      // For debugging
      console.log('Feature found:', feature.place_name);

      if (feature.context) {
        const placeItem = feature.context.find((item: any) =>
          item.id.startsWith('place.')
        );

        const regionItem = feature.context.find((item: any) =>
          item.id.startsWith('region.')
        );

        if (placeItem && regionItem) {
          return `${placeItem.text}, ${regionItem.text}`;
        } else if (placeItem) {
          return placeItem.text;
        } else if (regionItem) {
          return regionItem.text;
        }
      }

      // If no context items matched, return the place_name or text
      return feature.place_name || feature.text;
    }

    // Fallback to coordinates
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Error getting location name:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

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
    if (!validateCoordinates(lat, lng)) {
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

export default getLocationNameFromCoordinates;
