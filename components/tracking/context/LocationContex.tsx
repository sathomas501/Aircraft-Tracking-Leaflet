import React, { createContext, useContext, ReactNode } from 'react';

// You can adjust this type to match your specific MapboxFeature shape
export interface MapboxFeature {
  id: string;
  text: string;
  place_name?: string;
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface LocationContextType {
  formatCityCountry: (locationString: string | null) => string;
  extractCountryFromFeature: (feature: MapboxFeature) => string;
  extractCountryFromString: (locationString: string | null) => string;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider = ({ children }: LocationProviderProps) => {
  const formatCityCountry = (locationString: string | null): string => {
    if (!locationString) return '';
    const parts = locationString.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      const country = parts[parts.length - 1];
      let city = parts[0];
      if (parts.length >= 3 && parts[0] === parts[1]) city = parts[0];
      return `${city}, ${country}`;
    }
    return locationString;
  };

  const extractCountryFromFeature = (feature: MapboxFeature): string => {
    if (!feature) return '';

    const countryContext = feature.context?.find((c) =>
      c.id.startsWith('country.')
    );
    if (countryContext) return countryContext.text;

    if (feature.id.startsWith('country.')) return feature.text;

    if (feature.place_name) {
      const parts = feature.place_name.split(',').map((p) => p.trim());
      return parts.length ? parts[parts.length - 1] : '';
    }

    return '';
  };

  const extractCountryFromString = (locationString: string | null): string => {
    if (!locationString) return '';
    const parts = locationString.split(',').map((p) => p.trim());
    return parts.length ? parts[parts.length - 1] : locationString;
  };

  return (
    <LocationContext.Provider
      value={{
        formatCityCountry,
        extractCountryFromFeature,
        extractCountryFromString,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationUtils = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationUtils must be used within a LocationProvider');
  }
  return context;
};
