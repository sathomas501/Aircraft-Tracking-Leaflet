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
  // Log the full request details
  console.log('Mapbox Geocoding Request:');
  console.log('- Method:', req.method);
  console.log('- Query params:', JSON.stringify(req.query));
  console.log('- Headers:', JSON.stringify(req.headers));

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get query parameters
    const { query, limit = 1, types } = req.query;

    // Validate and log the query
    if (!query || typeof query !== 'string') {
      console.error('Missing or invalid query parameter:', query);
      return res.status(400).json({
        error: 'Missing or invalid query parameter',
      });
    }

    console.log('Processing reverse geocoding query:', query);

    // For reverse geocoding, try to detect and parse coordinates
    let isReverseGeocode = false;
    let coordinates = null;

    // Check if the query looks like coordinates (contains a comma and numbers)
    if (query.includes(',')) {
      const parts = query.split(',').map((part) => part.trim());
      if (
        parts.length === 2 &&
        !isNaN(parseFloat(parts[0])) &&
        !isNaN(parseFloat(parts[1]))
      ) {
        isReverseGeocode = true;
        coordinates = {
          lng: parseFloat(parts[0]),
          lat: parseFloat(parts[1]),
        };
        console.log(
          'Detected reverse geocoding request with coordinates:',
          coordinates
        );
      }
    }

    // Create a cache key that includes all parameters
    const cacheKey = `${query}_${limit}_${types || 'default'}`;

    // Check if we have this query in cache
    if (locationCache[cacheKey]) {
      console.log(`Using cached results for query "${query}"`);
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

    // Construct Mapbox API URL
    const encodedQuery = encodeURIComponent(query);
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json`;
    console.log('Mapbox API URL:', mapboxUrl);

    // Set up query parameters for Mapbox
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      limit: typeof limit === 'string' ? limit : '1',
    });

    // Add types parameter if provided
    if (types && typeof types === 'string') {
      params.append('types', types);
      console.log('Types parameter:', types);
    } else {
      // Default types if not specified
      params.append('types', 'place,postcode,address,poi,neighborhood,region');
      console.log('Using default types');
    }

    // Log the final request URL (with token masked)
    const paramsString = params.toString();
    const maskedParams = paramsString.replace(
      /access_token=([^&]+)/,
      'access_token=MASKED'
    );
    console.log(`Final Mapbox request: ${mapboxUrl}?${maskedParams}`);

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
          details: errorText,
        });
      }

      // Get JSON response from Mapbox
      const data = await response.json();

      // Log the response status and basic structure
      console.log('Mapbox API response status:', response.status);
      console.log('Mapbox API response type:', data.type);
      console.log('Features count:', data.features?.length || 0);

      // If no features were returned, log more details about the query
      if (!data.features || data.features.length === 0) {
        console.log('No features found for query:', query);
        console.log('Raw query string:', query);
        if (isReverseGeocode) {
          console.log('Parsed as coordinates:', coordinates);
        }
      } else {
        // Log basic info about the first feature
        const firstFeature = data.features[0];
        console.log('First feature:');
        console.log('- id:', firstFeature.id);
        console.log('- type:', firstFeature.type);
        console.log('- place_type:', firstFeature.place_type);
        console.log('- place_name:', firstFeature.place_name);
      }

      // Cache the results
      locationCache[cacheKey] = data;

      // Return the Mapbox response
      return res.status(200).json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError);
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
