// pages/api/proxy/geocode.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Cache to store already looked up ZIP codes
const zipCodeCache: Record<string, { lat: number; lng: number } | null> = {};

// Fallback mapping for common ZIP codes - can be expanded
const fallbackZipCodes: Record<string, { lat: number; lng: number }> = {
  '20191': { lat: 38.9589, lng: -77.3573 }, // Reston, VA
  '90210': { lat: 34.0901, lng: -118.4065 }, // Beverly Hills, CA
  '10001': { lat: 40.7501, lng: -73.9966 }, // New York, NY
  '60601': { lat: 41.8839, lng: -87.6219 }, // Chicago, IL
  '94105': { lat: 37.7911, lng: -122.3949 }, // San Francisco, CA
  '33139': { lat: 25.7834, lng: -80.1341 }, // Miami, FL
  '20001': { lat: 38.9129, lng: -77.0189 }, // Washington, DC
};

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

  try {
    // First, try the Census API with a shorter timeout
    const coordinates = await tryFetchFromCensusApi(zipCode);

    if (coordinates) {
      // Cache the result
      zipCodeCache[zipCode] = coordinates;

      return res.status(200).json({
        result: {
          addressMatches: [
            {
              coordinates: {
                x: coordinates.lng,
                y: coordinates.lat,
              },
            },
          ],
        },
        source: 'census',
      });
    }

    // If Census API fails, try the built-in fallback
    if (fallbackZipCodes[zipCode]) {
      console.log(`Using fallback coordinates for ZIP code ${zipCode}`);

      // Cache the result
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

    // If no fallback is available, try to compute an approximate location
    // based on the ZIP code's prefix (first 3 digits)
    const approximateCoordinates = await getApproximateCoordinates(zipCode);

    if (approximateCoordinates) {
      console.log(`Using approximate coordinates for ZIP code ${zipCode}`);

      // Cache the result
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
      tried: ['census', 'fallback', 'approximate'],
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
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
  } catch (error) {
    console.error(`Error fetching from Census API for ZIP ${zipCode}:`, error);
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
