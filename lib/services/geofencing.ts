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
 * Converts a US ZIP code to latitude and longitude coordinates
 *
 * @param zipCode The US ZIP code to convert (5 digits)
 * @returns Promise that resolves to {lat: number, lng: number} or null if not found
 */
export async function zipCodeToCoordinates(
  zipCode: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    // Ensure zip code is in the correct format (5 digits)
    const formattedZip = zipCode.replace(/[^0-9]/g, '').substring(0, 5);

    if (formattedZip.length !== 5) {
      throw new Error('ZIP code must be 5 digits');
    }

    console.log(`Fetching coordinates for ZIP code: ${formattedZip}`);

    // Add a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    try {
      // Call our proxy endpoint
      const response = await fetch(`/api/proxy/geocode?zip=${formattedZip}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Geocoding API error response:', errorData);
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Geocoding API response received', {
        hasResult: !!data.result,
        matchCount: data.result?.addressMatches?.length || 0,
        source: data.source || 'unknown',
      });

      // Check if we got valid results
      if (
        data.result?.addressMatches &&
        data.result.addressMatches.length > 0 &&
        data.result.addressMatches[0].coordinates
      ) {
        const coordinates = data.result.addressMatches[0].coordinates;

        // The response format should have x as longitude and y as latitude
        return {
          lat: coordinates.y,
          lng: coordinates.x,
        };
      }

      // If no matches found
      console.warn(`No coordinates found for ZIP code ${zipCode}`, data);
      return null;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error(
      `Error converting ZIP code ${zipCode} to coordinates:`,
      error
    );

    // Return null instead of throwing to prevent cascading failures
    // This makes the function more resilient for production use
    return null;
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

  return {
    lamin: Math.max(-90, centerLat - latDelta),
    lamax: Math.min(90, centerLat + latDelta),
    lomin: Math.max(-180, centerLng - lngDelta),
    lomax: Math.min(180, centerLng + lngDelta),
  };
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
  const coordinates = await zipCodeToCoordinates(zipCode);

  if (!coordinates) {
    return null;
  }

  return createGeofence(coordinates.lat, coordinates.lng, radiusKm);
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

    // Use the adapter to transform the raw aircraft data to ExtendedAircraft format
    const adaptedAircraft = adaptGeofenceAircraft(rawAircraft);

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
