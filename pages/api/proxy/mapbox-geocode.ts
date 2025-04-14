// pages/api/proxy/mapbox-geocode.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Cache to store already looked up locations
const locationCache: Record<string, any> = {};

/**
 * Proxy endpoint for Mapbox geocoding API
 *
 * This protects your Mapbox access token by keeping it server-side
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { zip, country } = req.query;
  const postalCode = Array.isArray(zip) ? zip[0] : zip;
  const countryCode = Array.isArray(country) ? country[0] : country || 'us'; // Default to US if not specified

  try {
    // Get query parameters
    const { query, limit = 1, types } = req.query;

    // Validate required parameters
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid query parameter',
      });
    }

    // Convert limit to number with validation
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : 1;

    // Create a cache key that includes all parameters
    const cacheKey = `${query}_${parsedLimit}_${types || 'default'}`;

    // Check if we have this query in cache
    if (locationCache[cacheKey]) {
      console.log(`Using cached results for query "${query}"`);
      return res.status(200).json({
        ...locationCache[cacheKey],
        source: 'cache',
      });
    }

    // Get Mapbox access token from environment variables
    // Use existing MAPBOX_API_KEY if available, fall back to MAPBOX_ACCESS_TOKEN
    const MAPBOX_ACCESS_TOKEN =
      process.env.MAPBOX_API_KEY || process.env.MAPBOX_ACCESS_TOKEN;

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('No Mapbox API key configured');
      return res.status(500).json({
        error: 'Mapbox API not properly configured',
      });
    }

    // Construct Mapbox API URL
    // Documentation: https://docs.mapbox.com/api/search/geocoding/
    const encodedQuery = encodeURIComponent(query);
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json`;

    // Set up query parameters for Mapbox
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      limit: parsedLimit.toString(),
      // Remove the country restriction or make it dynamic
      // country: 'us', // This was restricting to US results
    });

    // Optionally add country parameter if provided by the user
    if (countryCode) {
      params.append('country', countryCode);
    }

    // Add types parameter if provided
    if (types && typeof types === 'string') {
      params.append('types', types);
    } else {
      // Default types if not specified
      params.append('types', 'place,postcode,address,poi,neighborhood,region');
    }

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 second timeout

    try {
      // Make request to Mapbox API
      const response = await fetch(`${mapboxUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mapbox API error:', response.status, errorText);
        return res.status(response.status).json({
          error: `Mapbox API error: ${response.status}`,
        });
      }

      // Get JSON response from Mapbox
      const data = await response.json();

      // Cache the results
      locationCache[cacheKey] = data;

      // Debug the response
      console.log(
        `Mapbox API returned ${data.features?.length || 0} features for query "${query}"`
      );

      // Return the Mapbox response
      return res.status(200).json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in Mapbox geocoding proxy:', error);
    return res.status(500).json({
      error: 'Internal server error in geocoding proxy',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
