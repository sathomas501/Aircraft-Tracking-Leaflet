// components/tracking/filters/GeofenceFilter.tsx
import React, { useEffect, useRef } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { useFilterLogic } from '../hooks/useFilterLogicCompatible';
import { useGeofencePanel } from '../hooks/useGeofencePanel';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

// Simple toggle switch component to replace the imported one
const Toggle: React.FC<{
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled = false }) => {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
    </label>
  );
};

interface GeofenceFilterProps {
  onClose?: () => void;
}

const GeofenceFilter: React.FC<GeofenceFilterProps> = ({ onClose }) => {
  // Get map instance directly from the map context
  const mapContext = useEnhancedMapContext();

  const { state, actions, hasError } = useFilterLogic();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extract geofence state from the filter logic
  const {
    active: isGeofenceActive,
    location: geofenceLocation,
    radius: geofenceRadius,
    coordinates: geofenceCoordinates,
    isGettingLocation,
  } = state.filters.geofence;

  // Create local geofence panel with map instance from context
  const geofencePanel = useGeofencePanel({
    geofenceRadius,
    mapInstance: mapContext.mapInstance, // Use mapInstance from the context
    isGeofenceActive,
    toggleGeofenceState: (enabled) =>
      actions.updateFilter('geofence', 'active', enabled),
    setActiveDropdown: (dropdown) => actions.toggleDropdown(dropdown || ''),
    updateGeofenceAircraft: (aircraft) =>
      actions.updateFilter('geofence', 'aircraft', aircraft),
    setGeofenceCenter: (coords) =>
      actions.updateFilter('geofence', 'coordinates', coords),
    setGeofenceCoordinates: (coords) =>
      actions.updateFilter('geofence', 'coordinates', coords),
    processGeofenceSearch: () => actions.processGeofenceSearch(true),
    // Fixed: Added setCoordinates and setShowPanel to match interface
    setCoordinates: (position) => {
      // This should be connecting to our state management
      // Not directly used in this component
    },
    setShowPanel: (show) => {
      // This would connect to state management to show/hide panels
      // Not directly used in this component
    },
  });

  // Focus the search input when the filter is opened
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    actions.updateFilter('geofence', 'location', e.target.value);
  };

  // Handle radius change
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      actions.updateFilter('geofence', 'radius', value);
    }
  };

  // Handle search button click
  const handleSearch = () => {
    actions.processGeofenceSearch();
    if (onClose) onClose();
  };

  // Handle get location button click
  const handleGetLocation = () => {
    actions.getGeofenceUserLocation();
    if (onClose) onClose();
  };

  // Handle toggle change
  const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    actions.updateFilter('geofence', 'active', e.target.checked);
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
            onClick={handleGetLocation}
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
        onClick={handleSearch}
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
          onChange={handleToggleChange}
          disabled={!geofenceCoordinates}
        />
      </div>
    </div>
  );
};

export default GeofenceFilter;
