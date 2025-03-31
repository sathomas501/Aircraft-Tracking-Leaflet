// components/tracking/AircraftLookupTabs.tsx
import React, { useState, useEffect } from 'react';
import { useEnhancedMapContext } from '../tracking/context/EnhancedMapContext';
import EnhancedUnifiedSelector from '../tracking/selector/EnhancedUnifiedSelector';
import GeofenceTracker from './geoFenceTracker';
import type { ExtendedAircraft, SelectOption } from '../../types/base';
import { adaptGeofenceAircraft } from '../../lib/utils/geofenceAdapter';

// Define the lookup mode
type LookupMode = 'manufacturer' | 'geofence';

// Define the props for the component
interface AircraftLookupTabsProps {
  manufacturers: SelectOption[];
}

const AircraftLookupTabs: React.FC<AircraftLookupTabsProps> = ({
  manufacturers,
}) => {
  // State to track which tab is active
  const [activeTab, setActiveTab] = useState<LookupMode>('manufacturer');
  const [geofenceAircraft, setGeofenceAircraft] = useState<ExtendedAircraft[]>(
    []
  );
  const [geofenceLocation, setGeofenceLocation] = useState<{
    label: string;
    coordinates?: { lat: number; lng: number };
    radius: number;
  }>({
    label: 'No location selected',
    radius: 25,
  });

  // Get map context
  const mapContext = useEnhancedMapContext();

  // Handle switch to geofence tab
  const handleTabChange = (tab: LookupMode) => {
    if (tab === activeTab) return;

    // If switching away from manufacturer mode, remember the current state
    // so we can restore it when switching back
    if (activeTab === 'manufacturer' && tab === 'geofence') {
      // Clear current aircraft from the map when switching to geofence mode
      mapContext.selectManufacturer(null);
    }

    setActiveTab(tab);
  };

  const handleGeofenceAircraftFound = (
    aircraft: any[],
    locationInfo?: {
      label: string;
      coordinates?: { lat: number; lng: number };
      radius: number;
    }
  ) => {
    console.log('[AircraftLookupTabs] Aircraft found callback triggered!');
    console.log(`[AircraftLookupTabs] Received ${aircraft.length} aircraft`);

    // Adapt geofence aircraft to match your system's ExtendedAircraft format
    const adaptedAircraft = adaptGeofenceAircraft(aircraft);

    if (adaptedAircraft.length > 0) {
      console.log(
        '[AircraftLookupTabs] First aircraft data after adaptation:',
        adaptedAircraft[0]
      );
    }

    if (locationInfo) {
      console.log('[AircraftLookupTabs] Location info:', locationInfo);
    }

    // Store the geofenced aircraft for display in this component
    setGeofenceAircraft(adaptedAircraft);

    // Update location info if provided
    if (locationInfo) {
      setGeofenceLocation(locationInfo);
    }

    // Update aircraft data in the context
    mapContext.updateAircraftData(adaptedAircraft);

    // If we have coordinates and a map instance, center the map
    if (locationInfo?.coordinates && mapContext.mapInstance) {
      const { lat, lng } = locationInfo.coordinates;

      console.log(`[AircraftLookupTabs] Centering map on: ${lat}, ${lng}`);

      // Center the map
      mapContext.mapInstance.setView([lat, lng], 10);

      // Calculate map bounds based on radius
      const radiusInDegrees = locationInfo.radius / 111; // Rough conversion from km to degrees
      const bounds = [
        [lat - radiusInDegrees, lng - radiusInDegrees],
        [lat + radiusInDegrees, lng + radiusInDegrees],
      ];

      // Fit map to these bounds
      mapContext.mapInstance.fitBounds(bounds as any);
    }
  };

  // Effect to clear aircraft when unmounting or changing tabs
  useEffect(() => {
    return () => {
      if (activeTab === 'geofence') {
        setGeofenceAircraft([]);
      }
    };
  }, [activeTab]);

  // In your parent component where GeofenceTracker is used
  const handleAircraftFound = (
    aircraft: ExtendedAircraft[],
    locationInfo?: {
      label: string;
      coordinates?: { lat: number; lng: number };
      radius: number;
    }
  ) => {
    console.log('Aircraft found callback triggered!');
    console.log(`Received ${aircraft.length} aircraft`);
    console.log('First aircraft data:', aircraft[0]);
    console.log('Location info:', locationInfo);

    // Your existing code to update state...
  };

  // Then use it in your component
  <GeofenceTracker onAircraftFound={handleAircraftFound} />;
  // Determine which aircraft are currently active based on the tab
  useEffect(() => {
    // If in geofence mode, update the displayed aircraft
    if (activeTab === 'geofence' && geofenceAircraft.length > 0) {
      // The map will use context.displayedAircraft, so we don't need to do anything special here
      // Just ensuring we have proper data in the context
      mapContext.updateAircraftData(geofenceAircraft);
    }
  }, [activeTab, geofenceAircraft, mapContext]);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`py-3 px-4 font-medium flex items-center ${
            activeTab === 'manufacturer'
              ? 'text-indigo-600 border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => handleTabChange('manufacturer')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          Manufacturer/Model
        </button>

        <button
          className={`py-3 px-4 font-medium flex items-center ${
            activeTab === 'geofence'
              ? 'text-indigo-600 border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => handleTabChange('geofence')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Geofence Lookup
        </button>
      </div>

      {/* Content Area - Either Manufacturer Selector or Geofence Tracker */}
      <div className="relative">
        {/* Manufacturer Tab Content */}
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'manufacturer'
              ? 'opacity-100 relative'
              : 'opacity-0 absolute inset-0 pointer-events-none'
          }`}
          style={{ zIndex: activeTab === 'manufacturer' ? 1 : -1 }}
        >
          {activeTab === 'manufacturer' && (
            <EnhancedUnifiedSelector manufacturers={manufacturers} />
          )}
        </div>

        {/* Geofence Tab Content */}
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'geofence'
              ? 'opacity-100 relative'
              : 'opacity-0 absolute inset-0 pointer-events-none'
          }`}
          style={{ zIndex: activeTab === 'geofence' ? 1 : -1 }}
        >
          {activeTab === 'geofence' && (
            <div className="p-4">
              <GeofenceTracker
                onAircraftFound={handleGeofenceAircraftFound}
                autoRefresh={true}
                refreshInterval={60000}
              />

              {/* Status indicator for geofence mode */}
              {geofenceAircraft.length > 0 && (
                <div className="mt-4 bg-gray-50 p-3 rounded-md">
                  <div className="text-sm">
                    <div className="flex items-center text-indigo-700 font-medium mb-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Tracking {geofenceAircraft.length} aircraft</span>
                    </div>

                    <div className="text-gray-500 text-xs">
                      {geofenceLocation.label}{' '}
                      {geofenceLocation.radius &&
                        `(${geofenceLocation.radius}km radius)`}
                    </div>

                    {geofenceLocation.coordinates && (
                      <div className="text-gray-500 text-xs mt-1">
                        Coordinates:{' '}
                        {geofenceLocation.coordinates.lat.toFixed(4)},{' '}
                        {geofenceLocation.coordinates.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AircraftLookupTabs;
