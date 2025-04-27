// components/tracking/Ribbon.tsx
import React from 'react';
import { PlaneIcon } from 'lucide-react';
import { useFilterLogic } from './context/FilterContext';
import RegionFilterContainer from './filters/Containers/RegionFilterContainer';
import ManufacturerFilterContainer from './filters/Containers/ManufacturerFilterContainer';
import ModelFilterContainer from './filters/Containers/ModelFilterContainer';
import OwnerFilterContainer from './filters/Containers/OwnerFilterContainer';
import GeofenceFilterContainer from './filters/Containers/GeofenceFilterContainer';
import NotificationBar from './map/components/NotificationBar';
import SearchRibbonSpinner from './map/components/SearchRibbonSpinner';

const Ribbon: React.FC = () => {
  const {
    isLoading,
    notification,
    lastUpdated,
    quotaUsage,
    totalActive,
    regionCounts,
    refreshWithFilters,
    clearAllFilters,
    activeRegion,
    isGeofenceActive,
  } = useFilterLogic();

  // Local state for error message if needed
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Determine if certain controls should be disabled
  const isRegionDisabled = isGeofenceActive;
  const isLocationDisabled =
    activeRegion !== null && Number(activeRegion) !== 0;

  // Helper function to get loading message
  const getLoadingMessage = () => {
    if (!isLoading) return '';
    return 'Loading aircraft data...';
  };

  // Helper to render OpenSky quota information
  const renderOpenSkyQuota = () => {
    if (!quotaUsage) return null;

    return (
      <div className="text-xs text-gray-500 px-2">
        <span>API Quota: </span>
        <span
          className={
            quotaUsage.used > quotaUsage.total * 0.8
              ? 'text-red-500'
              : 'text-green-500'
          }
        >
          {quotaUsage.used}/{quotaUsage.total}
        </span>
      </div>
    );
  };

  // Helper to render aircraft statistics
  const renderAircraftStats = () => {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="px-3 py-1 bg-gray-100 rounded-md">
          <span className="font-medium">{totalActive}</span> aircraft
        </div>
        {regionCounts &&
          regionCounts.totalActive &&
          regionCounts.totalActive > 0 && (
            <div className="px-3 py-1 bg-gray-100 rounded-md">
              <span className="font-medium">{regionCounts.totalActive}</span> in
              region
            </div>
          )}
      </div>
    );
  };

  // Helper to render action buttons
  const renderActionButtons = () => {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={refreshWithFilters}
          className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-200 transition"
        >
          Refresh
        </button>
        <button
          onClick={clearAllFilters}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition"
        >
          Clear Filters
        </button>
      </div>
    );
  };

  // The main return - properly structured with a single return statement
  return (
    <>
      {/* Notification area */}
      {notification && (
        <div className="w-full bg-white shadow-sm">
          <NotificationBar
            notification={notification}
            lastUpdated={lastUpdated}
            type={notification.includes('Error') ? 'error' : 'info'}
          />
        </div>
      )}
      {/* Error message display */}
      {errorMessage && (
        <div className="w-full bg-white shadow-sm">
          <NotificationBar
            notification={errorMessage}
            lastUpdated={null}
            type="error"
          />
        </div>
      )}
      {/* Main ribbon */}
      <div className="w-full sticky top-0 z-[100] bg-white overflow-visible border-b border-gray-200">
        {/* Main ribbon containing all controls */}
        <div className="flex items-center gap-2 p-2">
          {/* Logo / Title */}
          <div className="bg-indigo-600 text-white flex items-center px-4 py-2 rounded-md font-semibold h-10">
            <PlaneIcon size={16} className="mr-2" />
            Aircraft Finder
          </div>
          {/* Group filters together */}
          <div className="flex items-center gap-2">
            {/* Region Dropdown - disabled when location is active */}
            <div
              className={
                isRegionDisabled ? 'opacity-50 pointer-events-none' : ''
              }
            >
              <RegionFilterContainer />
            </div>

            <ManufacturerFilterContainer />
            <ModelFilterContainer />
            <OwnerFilterContainer />

            {/* Location Dropdown - disabled when region is active */}
            <div
              className={
                isLocationDisabled ? 'opacity-50 pointer-events-none' : ''
              }
            >
              <GeofenceFilterContainer />
            </div>
          </div>
          {/* Spacer */}
          <div className="flex-grow"></div>
          {/* OpenSky quota usage if available */}
          {renderOpenSkyQuota()}
          {/* Aircraft Stats Display */}
          {renderAircraftStats()}
          {/* Action Buttons */}
          {renderActionButtons()}
        </div>
      </div>
      {/* Search Ribbon Spinner - Shows when loading */}
      <SearchRibbonSpinner
        isLoading={isLoading}
        loadingText={getLoadingMessage()}
      />
    </>
  );
};

export default Ribbon;
