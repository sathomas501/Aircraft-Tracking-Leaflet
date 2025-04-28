import React from 'react';
import { useFilterLogic } from './hooks/useFilterLogicCompatible';
import ManufacturerFilter from './filters/ManufacturerFilter';
import ModelFilter from './filters/ModelFilter';
import GeofenceFilter from './filters/GeofenceFilter';
import OwnerFilter from './filters/OwnerFilter';
import RegionFilter from './filters/RegionFilter';
import SearchRibbonSpinner from './map/components/SearchRibbonSpinner';
import { RibbonClearFiltersButton } from './map/components/ribbon-clear';
import { useEnhancedMapContext } from './context/EnhancedMapContext';
import type { RibbonProps } from './types/filters';
import ManualRefreshButton from './map/components/ManualRefreshButton';
import StandaloneFilterDropdown from './filters/FilterDropdown';
import { FilterMode } from './types/filterState';

const RibbonAircraftSelector: React.FC<RibbonProps> = ({ manufacturers }) => {
  // Get the aircraft state from context
  const { totalActive, activeModels, displayedAircraft } =
    useEnhancedMapContext();

  // Use our custom hook for filter logic
  const filterLogic = useFilterLogic();

  const {
    filterMode,
    activeDropdown,
    selectedManufacturer,
    selectedModel,
    geofenceLocation,
    geofenceRadius,
    isGeofenceActive,
    geofenceCoordinates,
    activeRegion,
    ownerFilters,
    allOwnerTypes,
    manufacturerSearchTerm,
    combinedLoading,
    isGettingLocation,
    dropdownRefs,
    isRefreshing,
    localLoading,

    // Methods
    toggleDropdown,
    toggleFilterMode,
    selectManufacturerAndClose,
    handleModelSelect,
    getUserLocation,
    processGeofenceSearch,
    handleOwnerFilterChange,
    handleRegionSelect,
    setManufacturerSearchTerm,
    setGeofenceLocation,
    setGeofenceRadius,
    setGeofenceCoordinates,
    setGeofenceCenter,
    updateGeofenceAircraft,
    toggleGeofenceState,
    clearAllFilters,
  } = filterLogic;

  // Determine loading state and loading message
  const isLoading = combinedLoading || isRefreshing || localLoading;
  const getLoadingMessage = (): string => {
    if (filterMode === 'manufacturer') {
      return `Finding ${selectedManufacturer || ''} aircraft...`;
    } else if (filterMode === 'geofence') {
      return 'Searching for aircraft in this location...';
    } else if (filterMode === 'both') {
      return `Finding ${selectedManufacturer || ''} aircraft near this location...`;
    } else if (filterMode === 'owner') {
      return 'Filtering aircraft by owner type...';
    } else if (filterMode === 'region') {
      return 'Searching for aircraft in this region...';
    }
    return 'Searching for aircraft...';
  };

  const renderActionButtons = () => {
    return (
      <div className="flex items-center gap-2 px-3">
        <ManualRefreshButton
          onRefresh={async () => filterLogic.refreshWithFilters()}
          disabled={combinedLoading || localLoading || isRefreshing}
        />
        <RibbonClearFiltersButton onClear={clearAllFilters} />
      </div>
    );
  };

  // Render Aircraft Stats
  const renderAircraftStats = () => {
    let displayCount = 0;
    let displayStatusText = '';

    if (filterMode === 'geofence' || filterMode === 'both') {
      displayCount = filterLogic.isGeofenceActive
        ? displayedAircraft?.length || 0
        : 0;
      displayStatusText = 'Aircraft in location';
    } else if (filterMode === 'owner' || filterMode === 'region') {
      displayCount = displayedAircraft?.length || 0;
      displayStatusText =
        filterMode === 'owner' ? 'Aircraft by owner' : 'Aircraft in region';
    } else {
      displayCount = totalActive;
      displayStatusText = 'Active aircraft';
    }

    return (
      <div className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm border-l">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          <span className="font-medium text-indigo-600">{displayCount}</span>{' '}
          {displayStatusText}
        </span>

        {combinedLoading && (
          <svg
            className="animate-spin ml-2 h-4 w-4 text-indigo-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="w-full sticky top-0 z-[100] bg-white overflow-visible">
        {/* Main ribbon containing all controls */}
        <div className="flex items-center h-12">
          {/* Logo / Title */}
          <div className="bg-indigo-600 text-white h-full flex items-center px-4 font-semibold">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            Aircraft Finder
          </div>

          {/* Filter Mode Dropdown */}
          <StandaloneFilterDropdown
            currentFilterMode={filterMode}
            onFilterModeChange={toggleFilterMode}
            selectedManufacturer={selectedManufacturer}
            isGeofenceActive={isGeofenceActive}
          />

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300 mx-1"></div>

          {/* Region Dropdown */}
          <RegionFilter
            activeRegion={activeRegion}
            handleRegionSelect={handleRegionSelect}
            activeDropdown={activeDropdown}
            toggleDropdown={toggleDropdown}
            dropdownRef={dropdownRefs.region}
            isGeofenceActive={isGeofenceActive}
            selectedRegion={Number(filterLogic.selectedRegion)}
            geofence={
              filterLogic.geofenceCoordinates
                ? { active: true }
                : { active: false }
            }
            manufacturer={{
              value: selectedManufacturer,
              active: !!selectedManufacturer,
            }}
            region={{
              value: filterLogic.selectedRegion
                ? String(filterLogic.selectedRegion)
                : null,
              active: !!filterLogic.selectedRegion,
            }}
          />

          {/* Manufacturer Dropdown */}
          <ManufacturerFilter
            manufacturers={manufacturers}
            selectedManufacturer={selectedManufacturer}
            manufacturerSearchTerm={manufacturerSearchTerm}
            setManufacturerSearchTerm={setManufacturerSearchTerm}
            selectManufacturerAndClose={selectManufacturerAndClose}
            combinedLoading={combinedLoading}
            activeDropdown={activeDropdown}
            dropdownRef={dropdownRefs.manufacturer}
            toggleDropdown={toggleDropdown}
          />

          {/* Model Dropdown */}
          <ModelFilter
            selectedManufacturer={selectedManufacturer}
            selectedModel={selectedModel}
            activeDropdown={activeDropdown}
            handleModelSelect={handleModelSelect}
            toggleDropdown={toggleDropdown}
            dropdownRef={dropdownRefs.model}
            totalActive={totalActive}
            activeModels={activeModels}
          />

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300 mx-1"></div>

          {/* Location Dropdown */}
          <GeofenceFilter
            geofenceLocation={geofenceLocation}
            geofenceRadius={geofenceRadius}
            isGettingLocation={isGettingLocation}
            isGeofenceActive={isGeofenceActive}
            geofenceCoordinates={geofenceCoordinates}
            getUserLocation={getUserLocation}
            processGeofenceSearch={processGeofenceSearch}
            toggleGeofenceState={toggleGeofenceState}
            setGeofenceLocation={setGeofenceLocation}
            setGeofenceRadius={setGeofenceRadius}
            setGeofenceCoordinates={setGeofenceCoordinates}
            setGeofenceCenter={setGeofenceCenter}
            updateGeofenceAircraft={updateGeofenceAircraft}
            combinedLoading={combinedLoading}
            activeDropdown={activeDropdown}
            setActiveDropdown={filterLogic.setActiveDropdown}
            toggleDropdown={toggleDropdown}
            dropdownRef={dropdownRefs.location}
            isGeofencePlacementMode={filterLogic.isGeofencePlacementMode}
            setIsGettingLocation={filterLogic.setIsGettingLocation}
          />

          {/* Owner Type Dropdown */}
          <OwnerFilter
            activeFilters={ownerFilters}
            onFilterChange={handleOwnerFilterChange}
            allOwnerTypes={allOwnerTypes}
            activeDropdown={activeDropdown}
            toggleFilterMode={toggleFilterMode}
            dropdownRef={dropdownRefs.owner}
            toggleDropdown={toggleDropdown}
          />

          {/* Spacer */}
          <div className="flex-grow"></div>

          {/* Aircraft Stats Display */}
          {renderAircraftStats()}

          {/* Action Buttons - This line uses the renderActionButtons function */}
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

export default RibbonAircraftSelector;
