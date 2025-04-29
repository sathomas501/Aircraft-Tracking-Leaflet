// FloatingGeofencePanel.tsx
import React, { useRef } from 'react';
import { X, Search, MapPin, Loader2 } from 'lucide-react';
import Draggable from 'react-draggable';
import { getFlagImageUrl } from '../../../utils/getFlagImage';
import { useFormattedCityCountry } from '../hooks/useFormattedCityCountry';

interface Coordinates {
  lat: number;
  lng: number;
}

interface PanelPosition {
  x: number;
  y: number;
}

interface FloatingGeofencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  geofenceRadius: number;
  setGeofenceRadius: (radius: number) => void;
  onSearch: (lat: number, lng: number) => void;
  panelPosition: PanelPosition | null;
  isGeofenceActive: boolean;
  geofenceLocation: Coordinates | null;
  setShowPanel: (show: boolean) => void;
  isSearching: boolean;
  coordinates: Coordinates | null;
  setCoordinates: (coords: Coordinates | null) => void;
  locationName: string | null;
  isLoadingLocation: boolean;
  processGeofenceSearch: (fromPanel?: boolean) => void;
  onReset: () => void;
  flagUrl?: string | null;
  hasError?: string | null;
}

const FloatingGeofencePanel: React.FC<FloatingGeofencePanelProps> = ({
  isOpen,
  onClose,
  geofenceRadius,
  setGeofenceRadius,
  onSearch,
  panelPosition,
  isGeofenceActive,
  geofenceLocation,
  setShowPanel,
  isSearching,
  coordinates,
  setCoordinates,
  locationName,
  isLoadingLocation,
  processGeofenceSearch,
  onReset,
  flagUrl: propFlagUrl,
  hasError,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const { label, isLoading } = useFormattedCityCountry(geofenceLocation, true);

  // Determine flag URL - use prop if provided, otherwise generate from location name
  const flagUrl =
    propFlagUrl ||
    (locationName
      ? getFlagImageUrl(locationName.split(',').pop()?.trim() || '')
      : null);

  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setGeofenceRadius(value);
    }
  };

  const handleSearchClick = () => {
    if (!coordinates) return;
    onSearch(coordinates.lat, coordinates.lng);
  };

  const renderFlagAndName = (displayName: string | null) => {
    if (!displayName) return null;

    const country = displayName.split(', ').pop() || '';
    const displayFlagUrl = flagUrl || getFlagImageUrl(country);

    return (
      <div className="inline-flex items-center gap-2">
        {displayFlagUrl && (
          <img
            src={displayFlagUrl}
            alt={`${country} flag`}
            className="w-4 h-3 object-cover rounded-sm shadow-sm"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        <span>{displayName}</span>
      </div>
    );
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".handle"
      position={panelPosition || undefined}
      onStop={(e, data) => {
        let newX = data.x;
        let newY = data.y;

        // Keep panel within viewport
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX > window.innerWidth - 320) newX = window.innerWidth - 320;
        if (newY > window.innerHeight - 220) newY = window.innerHeight - 220;

        // Notify parent that panel is shown (in case it was hidden)
        setShowPanel(true);

        // Update coordinates if they changed
        if (
          coordinates &&
          (Math.abs(newX - (panelPosition?.x || 0)) > 5 ||
            Math.abs(newY - (panelPosition?.y || 0)) > 5)
        ) {
          const updatedPanelPosition = { x: newX, y: newY };
          // This would need to go through your state management system
          // We're keeping coordinates for the search, not updating panel position here
        }
      }}
    >
      <div
        ref={nodeRef}
        className="absolute z-50 w-72 bg-white shadow-lg rounded-md overflow-hidden"
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        {/* Header - draggable area */}
        <div className="handle bg-blue-100 p-3 flex justify-between items-center cursor-move">
          <div className="flex items-center">
            <MapPin size={16} className="mr-2 text-blue-600" />
            <span className="font-medium text-blue-800">Geofence Panel</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-200 rounded"
            aria-label="Close panel"
          >
            <X size={16} className="text-blue-600" />
          </button>
        </div>

        {/* Panel content */}
        <div className="p-4 space-y-4">
          {/* Error message if present */}
          {hasError && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 p-2 rounded">
              {hasError}
            </div>
          )}

          {/* Location info */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Location
            </label>
            <div className="p-2 bg-gray-50 rounded border text-sm min-h-[24px]">
              {isLoadingLocation ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-blue-500" />
                  <span className="text-gray-500">Loading location...</span>
                </div>
              ) : (
                renderFlagAndName(locationName || label || '')
              )}
            </div>
          </div>

          {/* Radius slider */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">
                Radius
              </label>
              <span className="text-sm text-gray-500">{geofenceRadius} nm</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={geofenceRadius}
              onChange={handleRadiusChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isSearching}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>5 nm</span>
              <span>100 nm</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-2 pt-2">
            <button
              onClick={handleSearchClick}
              disabled={isSearching || !coordinates}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSearching ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search size={16} className="mr-2" />
                  <span>Search</span>
                </>
              )}
            </button>
            <button
              onClick={onReset}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded-md transition"
              disabled={isSearching}
              aria-label="Reset panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </Draggable>
  );
};

export default FloatingGeofencePanel;
