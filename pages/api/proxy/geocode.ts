// pages/api/proxy/geocode.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Cache to store already looked up ZIP codes
const zipCodeCache: Record<string, { lat: number; lng: number } | null> = {};

const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

// Fallback mapping for common ZIP codes - can be expanded
const fallbackZipCodes: Record<string, { lat: number; lng: number }> = {
  '20191': { lat: 38.9589, lng: -77.3573 }, // Reston, VA
  '90210': { lat: 34.0901, lng: -118.4065 }, // Beverly Hills, CA
  '10001': { lat: 40.7501, lng: -73.9966 }, // New York, NY
  '60601': { lat: 41.8839, lng: -87.6219 }, // Chicago, IL
  '94105': { lat: 37.7911, lng: -122.3949 }, // San Francisco, CA
  '33139': { lat: 25.7834, lng: -80.1341 }, // Miami, FL
  '20001': { lat: 38.9129, lng: -77.0189 }, // Washington, DC
  '27609': { lat: 35.8371, lng: -78.6387 }, // Raleigh, NC
  '77001': { lat: 29.7604, lng: -95.3698 }, // Houston, TX
  '85001': { lat: 33.4484, lng: -112.074 }, // Phoenix, AZ
  '75001': { lat: 32.7767, lng: -96.797 }, // Dallas, TX
  '98101': { lat: 47.6062, lng: -122.3321 }, // Seattle, WA
  '97201': { lat: 45.5051, lng: -122.675 }, // Portland, OR
  '80202': { lat: 39.7392, lng: -104.9903 }, // Denver, CO
  '89101': { lat: 36.1699, lng: -115.1398 }, // Las Vegas, NV
  '55401': { lat: 44.9778, lng: -93.265 }, // Minneapolis, MN
  '48201': { lat: 42.3314, lng: -83.0458 }, // Detroit, MI
  // Rhode Island and New England ZIP codes
  '02805': { lat: 41.8233, lng: -71.5801 }, // Clayville, RI
  '02855': { lat: 41.56, lng: -71.4103 }, // North Kingstown, RI
  '28805': { lat: 35.6009, lng: -82.5033 }, // Asheville, NC
};

// Basic US coordinate validation
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { zip } = req.query;
  const zipCode = Array.isArray(zip) ? zip[0] : zip;

  if (!zipCode || !isValidZip(zipCode)) {
    return res
      .status(400)
      .json({ error: 'Valid ZIP code is required (5 digits)' });
  }

  // Check if we have this ZIP code in cache
  if (zipCodeCache[zipCode] !== undefined) {
    console.log(`Using cached coordinates for ZIP code ${zipCode}`);

    if (zipCodeCache[zipCode] === null) {
      return res
        .status(404)
        .json({ error: 'No location found for this ZIP code' });
    }

    // Validate the cached coordinates
    if (
      !validateUSCoordinates(
        zipCodeCache[zipCode]!.lat,
        zipCodeCache[zipCode]!.lng
      )
    ) {
      console.error(
        `Invalid cached coordinates for ZIP ${zipCode}, clearing cache entry`
      );
      delete zipCodeCache[zipCode]; // Remove invalid cache entry
      // Continue to try other methods
    } else {
      return res.status(200).json({
        result: {
          addressMatches: [
            {
              coordinates: {
                x: zipCodeCache[zipCode]!.lng,
                y: zipCodeCache[zipCode]!.lat,
              },
            },
          ],
        },
        source: 'cache',
      });
    }
  }

  try {
    // First, try the Census API with a shorter timeout
    const censusCoordinates = await tryFetchFromCensusApi(zipCode);

    if (
      censusCoordinates &&
      validateUSCoordinates(censusCoordinates.lat, censusCoordinates.lng)
    ) {
      // Cache the valid result
      zipCodeCache[zipCode] = censusCoordinates;

      return res.status(200).json({
        result: {
          addressMatches: [
            {
              coordinates: {
                x: censusCoordinates.lng,
                y: censusCoordinates.lat,
              },
            },
          ],
        },
        source: 'census',
      });
    }

    // If Census API fails, try Mapbox
    const mapboxCoordinates = await tryFetchFromMapbox(zipCode);

    if (
      mapboxCoordinates &&
      validateUSCoordinates(mapboxCoordinates.lat, mapboxCoordinates.lng)
    ) {
      // Cache the valid result
      zipCodeCache[zipCode] = mapboxCoordinates;

      return res.status(200).json({
        result: {
          addressMatches: [
            {
              coordinates: {
                x: mapboxCoordinates.lng,
                y: mapboxCoordinates.lat,
              },
            },
          ],
        },
        source: 'mapbox',
      });
    }

    // If Mapbox fails, try the built-in fallback
    if (fallbackZipCodes[zipCode]) {
      console.log(`Using fallback coordinates for ZIP code ${zipCode}`);

      // Validate fallback coordinates
      if (
        !validateUSCoordinates(
          fallbackZipCodes[zipCode].lat,
          fallbackZipCodes[zipCode].lng
        )
      ) {
        console.error(`Invalid fallback coordinates for ZIP ${zipCode}`);
      } else {
        // Cache the valid result
        zipCodeCache[zipCode] = fallbackZipCodes[zipCode];

        return res.status(200).json({
          result: {
            addressMatches: [
              {
                coordinates: {
                  x: fallbackZipCodes[zipCode].lng,
                  y: fallbackZipCodes[zipCode].lat,
                },
              },
            ],
          },
          source: 'fallback',
        });
      }
    }

    // If no fallback is available, try to compute an approximate location
    const approximateCoordinates = await getApproximateCoordinates(zipCode);

    if (
      approximateCoordinates &&
      validateUSCoordinates(
        approximateCoordinates.lat,
        approximateCoordinates.lng
      )
    ) {
      console.log(`Using approximate coordinates for ZIP code ${zipCode}`);

      // Cache the valid result
      zipCodeCache[zipCode] = approximateCoordinates;

      return res.status(200).json({
        result: {
          addressMatches: [
            {
              coordinates: {
                x: approximateCoordinates.lng,
                y: approximateCoordinates.lat,
              },
            },
          ],
        },
        source: 'approximate',
        approximate: true,
      });
    }

    // If all methods fail, return a not found response
    zipCodeCache[zipCode] = null;
    return res.status(404).json({
      error: 'No location found for this ZIP code',
      tried: ['census', 'mapbox', 'fallback', 'approximate'],
    });
  } catch (error) {
    console.error('Error in geocode proxy:', error);
    return res.status(500).json({
      error: 'Failed to fetch geocoding data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Helper function to validate ZIP code format
function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

// Try fetching from Census API with timeout
async function tryFetchFromCensusApi(
  zipCode: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log(
      `Attempting to fetch coordinates for ZIP code ${zipCode} from Census API`
    );

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout (increased from 5)

    try {
      const response = await fetch(
        `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=2020&format=json&address=${zipCode}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Census API returned status ${response.status} for ZIP ${zipCode}`
        );
        return null;
      }

      const data = await response.json();

      if (
        !data.result?.addressMatches ||
        data.result.addressMatches.length === 0
      ) {
        console.warn(`No matches found in Census API for ZIP ${zipCode}`);
        return null;
      }

      const coordinates = data.result.addressMatches[0].coordinates;
      return {
        lat: coordinates.y,
        lng: coordinates.x,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error(`Error fetching from Census API for ZIP ${zipCode}:`, error);
    return null;
  }
}

// Fixed Mapbox geocoding function
async function tryFetchFromMapbox(
  zipCode: string
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_API_KEY) {
    console.log('No Mapbox API key configured, skipping Mapbox geocoding');
    return null;
  }

  try {
    console.log(
      `Attempting to fetch coordinates for ZIP code ${zipCode} from Mapbox`
    );

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      // IMPORTANT: This is the correct Mapbox URL, not the Census API URL
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${zipCode}.json?access_token=${MAPBOX_API_KEY}&country=us&types=postcode`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Mapbox API returned status ${response.status} for ZIP ${zipCode}`
        );
        return null;
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.warn(`No matches found in Mapbox API for ZIP ${zipCode}`);
        return null;
      }

      // Debug the Mapbox response
      console.log(
        `Mapbox API returned ${data.features.length} features for ZIP ${zipCode}`
      );

      // Get coordinates from the first feature
      const coordinates = data.features[0].center;

      // Mapbox returns coordinates as [longitude, latitude]
      const result = {
        lat: coordinates[1],
        lng: coordinates[0],
      };

      console.log(
        `Mapbox coordinates for ZIP ${zipCode}: ${result.lat}, ${result.lng}`
      );

      return result;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error(`Error fetching from Mapbox API for ZIP ${zipCode}:`, error);
    return null;
  }
}

// Get approximate coordinates based on ZIP prefix
async function getApproximateCoordinates(
  zipCode: string
): Promise<{ lat: number; lng: number } | null> {
  // Basic mapping of ZIP code prefixes to regions
  // This is very approximate and should be expanded for production use
  const zipPrefixMap: Record<string, { lat: number; lng: number }> = {
    '100': { lat: 40.7128, lng: -74.006 }, // New York area
    '200': { lat: 38.9072, lng: -77.0369 }, // DC area
    '300': { lat: 33.749, lng: -84.388 }, // Atlanta area
    '400': { lat: 39.9612, lng: -82.9988 }, // Ohio area
    '500': { lat: 39.7684, lng: -86.1581 }, // Indianapolis area
    '600': { lat: 41.8781, lng: -87.6298 }, // Chicago area
    '700': { lat: 38.627, lng: -90.1994 }, // St. Louis area
    '800': { lat: 39.7392, lng: -104.9903 }, // Denver area
    '900': { lat: 34.0522, lng: -118.2437 }, // Los Angeles area
    // New England prefixes
    '020': { lat: 41.824, lng: -71.4128 }, // Rhode Island area
    '021': { lat: 42.3601, lng: -71.0589 }, // Boston area
    '027': { lat: 41.6032, lng: -73.0877 }, // Western Massachusetts
    '028': { lat: 41.824, lng: -71.4128 }, // Rhode Island area
  };

  // Get the prefix (first 1-3 digits)
  const prefix3 = zipCode.substring(0, 3);
  const prefix2 = zipCode.substring(0, 2);
  const prefix1 = zipCode.substring(0, 1);

  // Try to find a match for the prefix, starting with the most specific
  if (zipPrefixMap[prefix3]) {
    return zipPrefixMap[prefix3];
  } else if (zipPrefixMap[prefix2 + '0']) {
    return zipPrefixMap[prefix2 + '0'];
  } else if (zipPrefixMap[prefix1 + '00']) {
    return zipPrefixMap[prefix1 + '00'];
  }

  return null;
}
