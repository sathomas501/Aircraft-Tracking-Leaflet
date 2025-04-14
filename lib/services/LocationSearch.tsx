// components/LocationSearch.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  getLocationSuggestions,
  getAircraftNearSearchedLocation,
} from '../services/geofencing';
import type { ExtendedAircraft } from '../../types/base';

interface LocationSearchProps {
  onLocationSelected?: (query: string, lat: number, lng: number) => void;
  onAircraftLoaded?: (aircraft: ExtendedAircraft[]) => void;
  defaultRadius?: number;
  className?: string;
}

/**
 * Location search component with autocomplete suggestions
 */
const LocationSearch: React.FC<LocationSearchProps> = ({
  onLocationSelected,
  onAircraftLoaded,
  defaultRadius = 25,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<
    Array<{
      name: string;
      lat: number;
      lng: number;
      placeType: string;
    }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(defaultRadius);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const results = await getLocationSuggestions(query, 5);
        setSuggestions(results);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      }
    };

    // Debounce the suggestions fetch
    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: {
    name: string;
    lat: number;
    lng: number;
  }) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);

    // Call the onLocationSelected callback if provided
    if (onLocationSelected) {
      onLocationSelected(suggestion.name, suggestion.lat, suggestion.lng);
    }

    // Load aircraft data if callback is provided
    if (onAircraftLoaded) {
      setLoading(true);
      try {
        const aircraft = await getAircraftNearSearchedLocation(
          suggestion.name,
          radius
        );
        onAircraftLoaded(aircraft);
      } catch (error) {
        console.error('Error fetching aircraft:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle search form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);

    if (!query.trim()) return;

    setLoading(true);
    try {
      // If we have a callback for aircraft data, fetch it
      if (onAircraftLoaded) {
        const aircraft = await getAircraftNearSearchedLocation(query, radius);
        onAircraftLoaded(aircraft);
      }
    } catch (error) {
      console.error('Error fetching aircraft data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-grow">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Enter location (city, ZIP, address...)"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <div className="font-medium">{suggestion.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex items-center">
            <label htmlFor="radius" className="mr-2 whitespace-nowrap">
              Radius (km):
            </label>
            <input
              type="number"
              id="radius"
              value={radius}
              onChange={(e) =>
                setRadius(
                  Math.max(1, parseInt(e.target.value) || defaultRadius)
                )
              }
              className="w-20 px-2 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="500"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">Searching for aircraft...</p>
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
