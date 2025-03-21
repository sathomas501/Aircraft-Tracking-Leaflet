// components/Map/MapComponent.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import type { SelectOption, ExtendedAircraft } from '@/types/base';
import type { AircraftModel } from '@/types/aircraft-models';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import UnifiedSelector from '../selector/UnifiedSelector';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import ReactBaseMap from '../../../tracking/map/ReactBaseMap';
import { MapProvider } from '../../../tracking/context/MapContext';

// Dynamically import the map to avoid SSR issues with Leaflet
const LeafletMap = dynamic(
  () => import('../../../tracking/map/MapContextWrapper'),
  {
    ssr: false,
    loading: () => <LoadingSpinner message="Loading map..." />,
  }
);

// Import the new implementation when you create it
const OptimizedReactBaseMap = dynamic(
  () => import('../../../tracking/map/ReactBaseMap'),
  {
    ssr: false,
    loading: () => <LoadingSpinner message="Loading optimized map..." />,
  }
);

interface MapComponentProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

interface MapComponentState {
  selectedManufacturer: string | null;
  selectedModel: string | null;
  displayedAircraft: ExtendedAircraft[];
  activeModels: AircraftModel[];
  isLoading: boolean;
  isRefreshing: boolean;
  trackingStatus: string;
  lastRefreshed: string | null;
  totalActive: number;
  preserveMapView?: boolean;
  useNewImplementation: boolean; // Add this line
  mapMode: 'legacy' | 'react' | 'optimized';
}

class MapComponent extends React.Component<
  MapComponentProps,
  MapComponentState
> {
  // Aircraft data unsubscribe functions
  private unsubscribeAircraft: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private map: any; // Add this line to define the map property

  constructor(props: MapComponentProps) {
    super(props);

    this.state = {
      selectedManufacturer: null,
      selectedModel: null,
      displayedAircraft: [],
      activeModels: [],
      isLoading: false,
      isRefreshing: false,
      trackingStatus: '',
      lastRefreshed: null,
      totalActive: 0,
      preserveMapView: false,
      useNewImplementation: false,
      mapMode: 'legacy',
    };

    // Bind methods
    this.handleManufacturerSelect = this.handleManufacturerSelect.bind(this);
    this.handleModelSelect = this.handleModelSelect.bind(this);
    this.handleReset = this.handleReset.bind(this);
    this.updateAircraftDisplay = this.updateAircraftDisplay.bind(this);
    this.handleStatusUpdate = this.handleStatusUpdate.bind(this);
    this.refreshPositionsOnly = this.refreshPositionsOnly.bind(this);
    this.handleFullRefresh = this.handleFullRefresh.bind(this);
    this.toggleImplementation = this.toggleImplementation.bind(this);
    this.toggleMapMode = this.toggleMapMode.bind(this);
  }

  // Add a method to toggle between implementations
  toggleImplementation() {
    this.setState((prevState) => ({
      useNewImplementation: !prevState.useNewImplementation,
    }));
  }

  toggleMapMode(mode: 'legacy' | 'react' | 'optimized') {
    this.setState({ mapMode: mode });
  }

  componentDidMount() {
    // Subscribe to aircraft updates
    this.unsubscribeAircraft = openSkyTrackingService.subscribeToAircraft(() =>
      this.updateAircraftDisplay()
    );

    // Subscribe to status updates
    this.unsubscribeStatus = openSkyTrackingService.subscribeToStatus(
      this.handleStatusUpdate
    );
  }

  componentWillUnmount() {
    // Clean up subscriptions
    if (this.unsubscribeAircraft) {
      this.unsubscribeAircraft();
    }

    if (this.unsubscribeStatus) {
      this.unsubscribeStatus();
    }

    // Clear any active intervals
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // Handle manufacturer selection
  async handleManufacturerSelect(manufacturer: string | null) {
    this.setState({
      selectedManufacturer: manufacturer,
      selectedModel: null,
      isLoading: true,
      lastRefreshed: null,
    });

    try {
      // Track the new manufacturer, ensuring it's always a string
      await openSkyTrackingService.trackManufacturer(manufacturer ?? '');

      // Update the lastRefreshed timestamp after successful tracking
      this.setState({
        lastRefreshed: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      this.props.onError(
        `Error tracking manufacturer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.setState({ isLoading: false });
    }
  }

  // Handle model selection
  handleModelSelect(model: string | null) {
    this.setState({ selectedModel: model }, () => {
      this.updateAircraftDisplay();
    });
  }

  // Handle reset
  handleReset() {
    this.handleManufacturerSelect(null);
  }

  // Update aircraft display based on model filter
  updateAircraftDisplay() {
    const { selectedModel } = this.state;

    // Get extended aircraft based on selected model
    const extendedAircraft = openSkyTrackingService.getExtendedAircraft(
      selectedModel || undefined
    );

    // Get model stats from the service
    const { models, totalActive } = openSkyTrackingService.getModelStats();

    this.setState({
      displayedAircraft: extendedAircraft,
      activeModels: models,
      totalActive: totalActive,
      isLoading: openSkyTrackingService.isLoading(),
    });
  }

  // Handle status updates
  handleStatusUpdate(status: string) {
    this.setState({
      trackingStatus: status,
      isLoading: openSkyTrackingService.isLoading(),
    });
  }

  // Method to refresh only the positions of active aircraft
  async refreshPositionsOnly() {
    if (!this.state.selectedManufacturer || this.state.isRefreshing) return;

    this.setState({
      isRefreshing: true,
      trackingStatus: 'Updating aircraft positions...',
      preserveMapView: true, // Add this line
    });

    if (!this.map) {
      console.warn('Map not initialized, cannot disable fitBounds');
      return;
    }
    const originalFitBounds = this.map.fitBounds;

    this.map.fitBounds = function () {
      console.log('fitBounds disabled during refresh');
      return this; // Maintain method chaining
    };

    try {
      // Call the OpenSkyTrackingService method for position-only refresh
      if (typeof openSkyTrackingService.refreshPositionsOnly === 'function') {
        await openSkyTrackingService.refreshPositionsOnly();
      } else {
        // Fallback to regular refresh if the method doesn't exist yet
        await openSkyTrackingService.refreshNow();
      }

      // Update last refreshed timestamp
      this.setState({
        lastRefreshed: new Date().toLocaleTimeString(),
        trackingStatus: `${this.state.displayedAircraft.length} aircraft tracked, positions updated`,
      });

      setTimeout(() => {
        try {
          if (this.map) {
            this.map.fitBounds = originalFitBounds;
            console.log('fitBounds functionality restored');
          }
        } catch (error) {
          console.error('Error restoring fitBounds:', error);
        }
      }, 2000);
    } finally {
      // Keep preserveMapView true until fitBounds is restored
      setTimeout(() => {
        this.setState({
          isRefreshing: false,
          preserveMapView: false,
        });
      }, 2000); // Match this with your fitBounds restoration timing
    }
  }

  // Method for full tracking refresh
  async handleFullRefresh() {
    if (!this.state.selectedManufacturer || this.state.isRefreshing) return;

    this.setState({
      isRefreshing: true,
      trackingStatus: 'Performing full refresh...',
    });

    try {
      await openSkyTrackingService.refreshNow();
      this.setState({
        lastRefreshed: new Date().toLocaleTimeString(),
        trackingStatus: `Full refresh completed with ${this.state.displayedAircraft.length} aircraft`,
      });
    } catch (error) {
      this.props.onError(
        `Error during full refresh: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.setState({ isRefreshing: false });
    }
  }

  // In your render method, conditionally import and render different maps
  render() {
    const { manufacturers, onError } = this.props;
    const {
      selectedManufacturer,
      selectedModel,
      displayedAircraft,
      activeModels,
      isLoading,
      isRefreshing,
      trackingStatus,
      lastRefreshed,
      totalActive,
      mapMode,
    } = this.state;

    const isTrackingActive =
      selectedManufacturer !== null && displayedAircraft.length > 0;

    return (
      <MapProvider>
        {' '}
        {/* ✅ Now everything inside has access to useMapContext() */}
        <div className="relative w-full h-screen">
          {/* Conditionally render different map implementations */}
          {mapMode === 'legacy' && (
            <LeafletMap aircraft={displayedAircraft} onError={onError} />
          )}

          {mapMode === 'react' && (
            <ReactBaseMap aircraft={displayedAircraft} onError={onError} />
          )}

          {mapMode === 'optimized' && (
            <OptimizedReactBaseMap
              aircraft={displayedAircraft}
              onError={onError}
            />
          )}

          {/* Integrated Aircraft & Model Selector */}
          <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
            <UnifiedSelector
              manufacturers={manufacturers}
              activeModels={activeModels}
              selectedManufacturer={selectedManufacturer}
              selectedModel={selectedModel}
              onManufacturerSelect={this.handleManufacturerSelect}
              onModelSelect={this.handleModelSelect}
              onReset={this.handleReset}
              onRefresh={this.handleFullRefresh}
              isLoading={isLoading || isRefreshing}
              totalActive={totalActive}
            />
          </div>

          {/* Refresh controls */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
            <button
              onClick={this.refreshPositionsOnly}
              disabled={!isTrackingActive || isRefreshing || isLoading}
              className={`bg-blue-500 text-white px-4 py-2 rounded shadow-md ${
                isTrackingActive && !isRefreshing && !isLoading
                  ? 'hover:bg-blue-600'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              Update Positions
            </button>

            <button
              onClick={this.handleFullRefresh}
              disabled={!isTrackingActive || isRefreshing || isLoading}
              className={`bg-green-500 text-white px-4 py-2 rounded shadow-md ${
                isTrackingActive && !isRefreshing && !isLoading
                  ? 'hover:bg-green-600'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              Full Refresh
            </button>
          </div>

          {/* Map toggle buttons */}
          <div className="absolute top-4 right-4 z-50 flex space-x-2">
            <button
              onClick={() => this.toggleMapMode('legacy')}
              className={`px-3 py-1 rounded shadow-md ${
                mapMode === 'legacy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Legacy
            </button>
            <button
              onClick={() => this.toggleMapMode('react')}
              className={`px-3 py-1 rounded shadow-md ${
                mapMode === 'react'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              React
            </button>
            <button
              onClick={() => this.toggleMapMode('optimized')}
              className={`px-3 py-1 rounded shadow-md ${
                mapMode === 'optimized'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Optimized
            </button>
          </div>

          {/* Status and last refresh info */}
          <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
            <p className="text-sm">{trackingStatus}</p>
            {lastRefreshed && (
              <p className="text-xs text-gray-600">
                Last updated: {lastRefreshed}
              </p>
            )}
            {selectedManufacturer && totalActive > 0 && (
              <p className="text-xs text-blue-600">
                Tracking {totalActive} aircraft
              </p>
            )}
          </div>
        </div>
      </MapProvider>
    );
  }
}

export default MapComponent;
