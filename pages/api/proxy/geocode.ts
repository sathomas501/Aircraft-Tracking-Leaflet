// pages/api/proxy/geocode.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Cache to store already looked up ZIP codes with country-specific keys
const zipCodeCache: Record<string, { lat: number; lng: number } | null> = {};

const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

// Global coordinate validation
function validateCoordinates(lat: number, lng: number): boolean {
  const isValidLat = lat >= -90.0 && lat <= 90.0;
  const isValidLng = lng >= -180.0 && lng <= 180.0;

  const isValid = isValidLat && isValidLng;

  if (!isValid) {
    console.error(`Invalid coordinates detected: lat ${lat}, lng ${lng}`);
    console.error('These coordinates are outside valid global bounds.');
  }

  return isValid;
}

// Helper function to validate postal code format by country
function isValidPostalCode(code: string, country: string): boolean {
  // Common postal code patterns by country
  const patterns: Record<string, RegExp> = {
    us: /^\d{5}$/, // 5 digits
    ca: /^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/, // Canadian format (A1A 1A1)
    uk: /^[A-Za-z]{1,2}\d[A-Za-z\d]? \d[A-Za-z]{2}$/, // UK format
    au: /^\d{4}$/, // Australia (4 digits)
    de: /^\d{5}$/, // Germany (5 digits)
    fr: /^\d{5}$/, // France (5 digits)
    jp: /^\d{3}-\d{4}$/, // Japan (3-4 digits)
    // Add more countries as needed
  };

  // If no specific pattern for this country, use a generic alphanumeric check
  const pattern = patterns[country.toLowerCase()] || /^[\w\d\s-]{2,10}$/;
  return pattern.test(code);
}

// Function to fetch coordinates from Mapbox
async function tryFetchFromMapbox(
  postalCode: string,
  countryCode: string = 'us'
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_API_KEY) {
    console.log('No Mapbox API key configured, skipping Mapbox geocoding');
    return null;
  }

  try {
    console.log(
      `Attempting to fetch coordinates for postal code ${postalCode} in ${countryCode} from Mapbox`
    );

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${postalCode}.json?access_token=${MAPBOX_API_KEY}&types=postcode&country=${countryCode}`,
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
          `Mapbox API returned status ${response.status} for postal code ${postalCode}`
        );
        return null;
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.warn(
          `No matches found in Mapbox API for postal code ${postalCode}`
        );
        return null;
      }

      // Debug the Mapbox response
      console.log(
        `Mapbox API returned ${data.features.length} features for postal code ${postalCode}`
      );

      // Get coordinates from the first feature
      const coordinates = data.features[0].center;

      // Mapbox returns coordinates as [longitude, latitude]
      const result = {
        lat: coordinates[1],
        lng: coordinates[0],
      };

      // Validate coordinates
      if (!validateCoordinates(result.lat, result.lng)) {
        console.error(
          `Invalid coordinates returned from Mapbox for postal code ${postalCode}`
        );
        return null;
      }

      console.log(
        `Mapbox coordinates for postal code ${postalCode}: ${result.lat}, ${result.lng}`
      );
      return result;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error(
      `Error fetching from Mapbox API for postal code ${postalCode}:`,
      error
    );
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set a timeout to ensure we always respond
  let hasResponded = false;
  const timeout = setTimeout(() => {
    if (!hasResponded) {
      console.warn('Geocode proxy timed out');
      hasResponded = true;
      res.status(504).json({ error: 'Geocode request timed out' });
    }
  }, 10000); // 10 second timeout

  try {
    const { zip, country } = req.query;
    const postalCode = Array.isArray(zip) ? zip[0] : zip;
    const countryCode = Array.isArray(country) ? country[0] : country || 'us'; // Default to US if not specified

    if (!postalCode) {
      hasResponded = true;
      clearTimeout(timeout);
      return res.status(400).json({ error: 'Postal code is required' });
    }

    if (!isValidPostalCode(postalCode, countryCode)) {
      hasResponded = true;
      clearTimeout(timeout);
      return res.status(400).json({
        error: 'Valid postal code is required for the specified country',
      });
    }

    // Create a cache key that includes country code
    const cacheKey = `${countryCode}:${postalCode}`;

    // Check cache with country-specific key
    if (zipCodeCache[cacheKey] !== undefined) {
      console.log(
        `Using cached coordinates for postal code ${postalCode} in ${countryCode}`
      );

      if (zipCodeCache[cacheKey] === null) {
        hasResponded = true;
        clearTimeout(timeout);
        return res
          .status(404)
          .json({ error: 'No location found for this postal code' });
      }

      hasResponded = true;
      clearTimeout(timeout);
      return res.status(200).json({
        result: {
          addressMatches: [
            {
              coordinates: {
                x: zipCodeCache[cacheKey]!.lng,
                y: zipCodeCache[cacheKey]!.lat,
              },
            },
          ],
        },
        source: 'cache',
      });
    }

    // Try to get coordinates from Mapbox
    const coordinates = await tryFetchFromMapbox(postalCode, countryCode);

    if (coordinates) {
      // Save to cache
      zipCodeCache[cacheKey] = coordinates;

      hasResponded = true;
      clearTimeout(timeout);
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
        source: 'mapbox',
      });
    }

    // If we get here, we couldn't find coordinates
    zipCodeCache[cacheKey] = null; // Cache the negative result

    hasResponded = true;
    clearTimeout(timeout);
    return res
      .status(404)
      .json({ error: 'Could not find coordinates for the postal code' });
  } catch (error) {
    console.error('Geocode proxy error:', error);

    hasResponded = true;
    clearTimeout(timeout);
    return res.status(500).json({
      error: `Geocode proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
