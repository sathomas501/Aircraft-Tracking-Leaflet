import { useEffect, useState } from 'react';
import { MapboxService } from '../../../lib/services/MapboxService'; // adjust path as needed

interface Coordinates {
  lat: number;
  lng: number;
}

export function useFormattedCityCountry(
  input: string | Coordinates | null,
  isDetailed: boolean
) {
  const [label, setLabel] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const resolveLabel = async () => {
      if (!input) {
        setLabel('');
        return;
      }

      setIsLoading(true);

      let locationString: string | null = null;

      if (typeof input === 'object' && 'lat' in input && 'lng' in input) {
        try {
          const feature = await MapboxService.reverseGeocode(
            input.lat,
            input.lng
          );
          locationString = feature?.place_name || null;
        } catch (error) {
          console.warn('Reverse geocode failed', error);
        }
      } else {
        locationString = input;
      }

      if (!locationString) {
        setLabel('');
        setIsLoading(false);
        return;
      }

      const parts: string[] = locationString
        .split(',')
        .map((p: string) => p.trim());

      if (parts.length >= 2) {
        const country: string = parts[parts.length - 1];
        let city: string = parts[0];
        if (parts.length >= 3 && parts[0] === parts[1]) city = parts[0];
        setLabel(`${city}, ${country}`);
      } else {
        setLabel(locationString);
      }

      setIsLoading(false);
    };

    resolveLabel();
  }, [input, isDetailed]);

  return { label, isLoading };
}
