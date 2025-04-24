// hooks/useGeolocationServices.ts
import { useState, useCallback } from 'react';

export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}

export function useGeolocationServices() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Function to get current position using browser's geolocation API
  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      setError(null);

      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported by your browser');
        setError(error.message);
        setLoading(false);
        reject(error);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoading(false);

          // Create a simplified position object matching our interface
          const positionData: GeolocationPosition = {
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp,
          };

          resolve(positionData);
        },
        (error) => {
          setError(error.message);
          setLoading(false);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return {
    error,
    loading,
    getCurrentPosition,
  };
}
