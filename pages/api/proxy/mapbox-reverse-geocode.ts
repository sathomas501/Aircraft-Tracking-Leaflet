// pages/api/proxy/mapbox-reverse-geocode.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Cache to store already looked up coordinates
const locationCache: Record<string, any> = {};

/**
 * Proxy endpoint for Mapbox reverse geocoding API
 *
 * This protects your Mapbox access token by keeping it server-side
 * and provides a simple interface for reverse geocoding (coordinates to place name)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get coordinates from query parameters
    const { lat, lng } = req.query;

    // Validate required parameters
    if (
      !lat ||
      !lng ||
      typeof lat !== 'string' ||
      typeof lng !== 'string' ||
      isNaN(parseFloat(lat)) ||
      isNaN(parseFloat(lng))
    ) {
      return res.status(400).json({
        error: 'Missing or invalid lat/lng parameters',
      });
    }

    // Parse coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Validate coordinate ranges
    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        error: 'Invalid coordinate values',
      });
    }

    // Optional parameters
    const { types = 'place,locality,neighborhood,address', limit = '1' } =
      req.query;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : 1;

    // Create a cache key
    const cacheKey = `${latitude.toFixed(6)}_${longitude.toFixed(6)}_${types}_${parsedLimit}`;

    // Check if we have this query in cache
    if (locationCache[cacheKey]) {
      console.log(
        `Using cached results for coordinates (${latitude}, ${longitude})`
      );
      return res.status(200).json({
        ...locationCache[cacheKey],
        source: 'cache',
      });
    }

    // Get Mapbox access token from environment variables
    const MAPBOX_ACCESS_TOKEN =
      process.env.MAPBOX_API_KEY || process.env.MAPBOX_ACCESS_TOKEN;

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('No Mapbox API key configured');
      return res.status(500).json({
        error: 'Mapbox API not properly configured',
      });
    }

    // Construct Mapbox API URL for reverse geocoding
    // Documentation: https://docs.mapbox.com/api/search/geocoding/#reverse-geocoding
    const coordinates = `${longitude},${latitude}`; // Note: Mapbox uses longitude,latitude order
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates}.json`;

    // Set up query parameters for Mapbox
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      limit: parsedLimit.toString(),
    });

    // Add types parameter if provided
    if (types && typeof types === 'string') {
      params.append('types', types);
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
        `Mapbox reverse geocoding API returned ${data.features?.length || 0} features for coordinates (${latitude}, ${longitude})`
      );

      // Return the Mapbox response
      return res.status(200).json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in Mapbox reverse geocoding proxy:', error);
    return res.status(500).json({
      error: 'Internal server error in reverse geocoding proxy',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
