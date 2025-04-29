// components/tracking/filters/GeofenceFilterComponent.tsx
import React, { useEffect, useRef } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';

// Simple toggle switch component
const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled = false }) => {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
    </label>
  );
};

// Define the props interface for the component
export interface GeofenceFilterComponentProps {
  isGeofenceActive: boolean;
  geofenceLocation: string;
  geofenceRadius: number;
  geofenceCoordinates: { lat: number; lng: number } | null;
  isGettingLocation: boolean;
  hasError: string | null;

  onLocationChange: (value: string) => void;
  onRadiusChange: (value: number) => void;
  onSearch: () => void;
  onGetLocation: () => void;
  onToggleChange: (enabled: boolean) => void;
}

const GeofenceFilterComponent: React.FC<GeofenceFilterComponentProps> = ({
  isGeofenceActive,
  geofenceLocation,
  geofenceRadius,
  geofenceCoordinates,
  isGettingLocation,
  hasError,
  onLocationChange,
  onRadiusChange,
  onSearch,
  onGetLocation,
  onToggleChange,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus the search input when the filter is opened
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onLocationChange(e.target.value);
  };

  // Handle radius change
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onRadiusChange(value);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Error message */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">
          {hasError}
        </div>
      )}

      {/* Location input group */}
      <div className="space-y-2">
        <label
          htmlFor="geofence-location"
          className="block text-sm font-medium text-gray-700"
        >
          Location
        </label>
        <div className="flex gap-2">
          <input
            ref={searchInputRef}
            id="geofence-location"
            type="text"
            value={geofenceLocation}
            onChange={handleLocationChange}
            placeholder="City, address, or coordinates"
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={onGetLocation}
            disabled={isGettingLocation}
            className="inline-flex items-center justify-center p-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            title="Get current location"
          >
            {isGettingLocation ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MapPin className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Radius slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label
            htmlFor="geofence-radius"
            className="block text-sm font-medium text-gray-700"
          >
            Radius
          </label>
          <span className="text-sm text-gray-500">{geofenceRadius} nm</span>
        </div>
        <input
          id="geofence-radius"
          type="range"
          min="5"
          max="100"
          step="5"
          value={geofenceRadius}
          onChange={handleRadiusChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>5 nm</span>
          <span>100 nm</span>
        </div>
      </div>

      {/* Search button */}
      <button
        onClick={onSearch}
        disabled={!geofenceLocation}
        className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <Search className="mr-2 h-5 w-5" />
        <span>Search</span>
      </button>

      {/* Toggle switch */}
      <div className="flex items-center justify-between pt-3 border-t">
        <span className="text-sm font-medium text-gray-700">
          Enable geofence
        </span>
        <Toggle
          checked={isGeofenceActive}
          onChange={onToggleChange}
          disabled={!geofenceCoordinates}
        />
      </div>
    </div>
  );
};

export default GeofenceFilterComponent;
