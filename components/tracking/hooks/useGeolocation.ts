// useGeofenceLocation.ts - Simplified hook that just tracks location name for coordinates
import { useState, useEffect, useRef } from 'react';
import { MapboxService } from '../../../lib/services/MapboxService';

interface Coordinates {
  lat: number;
  lng: number;
}

export function useGeolocation(coordinates: Coordinates | null) {
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const prevCoordinatesRef = useRef<Coordinates | null>(null);

  useEffect(() => {
    // Skip if no coordinates
    if (!coordinates) return;

    // Skip if same coordinates and we already have data or are loading
    const isSameCoordinates =
      prevCoordinatesRef.current?.lat === coordinates.lat &&
      prevCoordinatesRef.current?.lng === coordinates.lng;

    if (isSameCoordinates && (locationName || isLoadingLocation)) {
      return;
    }

    // Update reference and start loading
    prevCoordinatesRef.current = coordinates;
    setIsLoadingLocation(true);

    // Fetch location name
    MapboxService.getLocationNameFromCoordinates(
      coordinates.lat,
      coordinates.lng
    )
      .then((name) => {
        setLocationName(name);
      })
      .catch((error) => {
        console.error('Error fetching location name:', error);
      })
      .finally(() => {
        setIsLoadingLocation(false);
      });
  }, [coordinates, locationName, isLoadingLocation]);

  return { locationName, isLoadingLocation };
}
