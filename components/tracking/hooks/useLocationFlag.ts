// hooks/useLocationFlag.ts
import { useState, useEffect } from 'react';
import { MapboxService } from '../../../lib/services/MapboxService';
import { getFlagImageUrl } from '../../../utils/getFlagImage';

interface UseLocationFlagProps {
  mapboxFeature?: any;
  locationName?: string | null;
  countryName?: string | null;
}

export function useLocationFlag({
  mapboxFeature,
  locationName,
}: UseLocationFlagProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);

    // Priority order: mapboxFeature first (most data), then locationName
    if (mapboxFeature) {
      // Extract country data from the feature
      const country = MapboxService.extractCountryFromFeature(mapboxFeature);

      // Try to get a country code from properties
      let countryCode =
        mapboxFeature.properties?.short_code ||
        mapboxFeature.properties?.country_code;

      // Clean up code if it exists
      if (countryCode) {
        getFlagImageUrl(countryCode);
      }
      // Otherwise use country name
      else if (country) {
        setFlagUrl(MapboxService.getLocationFlagUrl(country));
      } else {
        // Fallback to place name
        setFlagUrl(MapboxService.getLocationFlagUrl(mapboxFeature.place_name));
      }
    }
    // If no feature but we have location name
    else if (locationName) {
      setFlagUrl(MapboxService.getLocationFlagUrl(locationName));
    } else {
      setFlagUrl(null);
    }

    setIsLoading(false);
  }, [mapboxFeature, locationName]);

  return { flagUrl, isLoading };
}
