import { getFlagImageUrl } from '../../utils/getFlagImage';

interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  relevance: number;
  properties: { [key: string]: any };
  text: string;
  place_name: string;
  center: [number, number];
  geometry: { type: string; coordinates: [number, number] };
  bbox?: [number, number, number, number];
  context?: Array<{ id: string; text: string }>;
}

interface MapboxResponse {
  type: string;
  query: string[];
  features: MapboxFeature[];
  attribution: string;
}

export interface GeofenceParams {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

export class MapboxService {
  static formatCityCountry(locationString: string | null): string {
    if (!locationString) return '';
    const parts = locationString.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      const country = parts[parts.length - 1];
      let city = parts[0];
      if (parts.length >= 3 && parts[0] === parts[1]) city = parts[0];
      return `${city}, ${country}`;
    }
    return locationString;
  }

  extractCountryFromFeature = (feature: MapboxFeature): string => {
    if (!feature) return '';

    const countryContext = feature.context?.find((c) =>
      c.id.startsWith('country.')
    );
    if (countryContext) {
      return countryContext.text;
    }

    if (feature.id.startsWith('country.')) {
      return feature.text;
    }

    // Fallback to parsing place_name (your original logic)
    if (feature.place_name) {
      const parts = feature.place_name.split(',').map((p) => p.trim());
      return parts.length ? parts[parts.length - 1] : '';
    }

    return '';
  };

  static extractCountry(locationString: string | null): string {
    if (!locationString) return '';
    const parts = locationString.split(',').map((p) => p.trim());
    return parts.length ? parts[parts.length - 1] : locationString;
  }

  static getLocationFlagUrl(locationString: string | null): string | null {
    if (!locationString) return null;
    const country = this.extractCountry(locationString);
    return getFlagImageUrl(country);
  }

  static validateCoordinates(lat: number, lng: number): boolean {
    if (isNaN(lat) || isNaN(lng)) {
      console.error(`Invalid coordinates: lat=${lat}, lng=${lng}`);
      return false;
    }
    const isValidLat = lat >= -90 && lat <= 90;
    const isValidLng = lng >= -180 && lng <= 180;
    if (!isValidLat || !isValidLng) {
      console.error(`Invalid coordinates detected: lat=${lat}, lng=${lng}`);
      return false;
    }
    return true;
  }

  static async searchLocationWithMapbox(
    query: string,
    limit: number = 1,
    types?: string,
    countryCode?: string
  ): Promise<
    Array<{
      lat: number;
      lng: number;
      name: string;
      bbox?: [number, number, number, number];
    }>
  > {
    try {
      const params = new URLSearchParams({ query, limit: limit.toString() });
      if (types) params.append('types', types);
      if (countryCode) params.append('country', countryCode);

      const response = await fetch(
        `/api/proxy/mapbox-geocode?${params.toString()}`,
        {
          headers: { 'Cache-Control': 'max-age=86400' },
        }
      );

      if (!response.ok)
        throw new Error(`Mapbox geocoding API error: ${response.status}`);

      const data: MapboxResponse = await response.json();
      if (!data.features?.length) return [];

      return data.features.map((feature) => {
        const [lng, lat] = feature.center;
        this.validateCoordinates(lat, lng);
        return {
          lat,
          lng,
          name: feature.place_name,
          bbox: feature.bbox,
        };
      });
    } catch (error) {
      console.error(`Mapbox location search failed:`, error);
      throw error;
    }
  }

  static async getCoordinatesFromQuery(
    query: string
  ): Promise<{ lat: number; lng: number; name: string } | null> {
    const coordsMatch = query.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[3]);
      return { lat, lng, name: `${lat}, ${lng}` };
    }

    const results = await this.searchLocationWithMapbox(
      query,
      1,
      'place,postcode,address,poi,neighborhood,region,locality'
    );

    return results.length ? { ...results[0], name: results[0].name } : null;
  }

  static async getLocationSuggestions(
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
    if (!query || query.trim().length < 2) return [];
    const locations = await this.searchLocationWithMapbox(
      query,
      Math.max(5, limit),
      'place,postcode,address,poi,neighborhood,region,locality'
    );

    return locations.slice(0, limit).map((loc) => ({
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      placeType: loc.name.split(',')[0],
    }));
  }

  static async getLocationNameFromCoordinates(
    lat: number,
    lng: number
  ): Promise<string | null> {
    if (isNaN(lat) || isNaN(lng)) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const coords = `${lng},${lat}`;

    try {
      const response = await fetch(
        `/api/proxy/mapbox-geocode?query=${encodeURIComponent(coords)}`
      );
      if (!response.ok) throw new Error(`Geocoding error: ${response.status}`);

      const data = await response.json();
      const feature = data.features?.[0];
      if (!feature) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      const placeItem = feature.context?.find((item: any) =>
        item.id.startsWith('place.')
      );
      const regionItem = feature.context?.find((item: any) =>
        item.id.startsWith('region.')
      );

      if (placeItem && regionItem)
        return `${placeItem.text}, ${regionItem.text}`;
      if (placeItem) return placeItem.text;
      if (regionItem) return regionItem.text;

      return feature.place_name || feature.text;
    } catch (error) {
      console.error(`Reverse geocoding failed:`, error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  static async postalCodeToCoordinates(
    postalCode: string,
    countryCode: string = 'us'
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await fetch(
        `/api/proxy/geocode?zip=${postalCode}&country=${countryCode}`,
        {
          headers: { 'Cache-Control': 'no-cache, no-store' },
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Postal geocode error (${response.status}): ${errText}`);
        return null;
      }

      const data = await response.json();
      const match = data.result?.addressMatches?.[0]?.coordinates;
      if (match) return { lat: match.y, lng: match.x };

      console.warn(`No coordinates found for postal code: ${postalCode}`);
      return null;
    } catch (error) {
      console.error(`Postal code geocoding failed:`, error);
      return null;
    }
  }
}
