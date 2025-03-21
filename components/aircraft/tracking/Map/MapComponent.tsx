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

// Import the worker-based version
const WorkerReactBaseMap = dynamic(
  () => import('../../../tracking/map/ReactBaseMap'),
  {
    ssr: false,
    loading: () => <LoadingSpinner message="Loading worker-based map..." />,
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
  mapMode: 'legacy' | 'react' | 'optimized' | 'worker';
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
  private _currentRefreshId: number | null = null;

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

  toggleMapMode(mode: 'legacy' | 'react' | 'optimized' | 'worker') {
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
  // Modified refreshPositionsOnly method
  async refreshPositionsOnly() {
    // Check if already refreshing or if a refresh is in progress
    if (this.state.isRefreshing || (window as any).__preventMapBoundsFit) {
      console.log('Refresh already in progress, skipping');
      return;
    }

    if (!this.state.selectedManufacturer) return;

    this.setState({
      isRefreshing: true,
      trackingStatus: 'Updating aircraft positions...',
      preserveMapView: true,
    });

    // Disable map bounds fitting
    const originalFitBounds = this.map?.fitBounds;
    if (this.map) {
      this.map.fitBounds = function () {
        console.log('fitBounds disabled during refresh');
        return this;
      };
    }

    try {
      // Call the service
      await openSkyTrackingService.refreshPositionsOnly();

      this.setState({
        lastRefreshed: new Date().toLocaleTimeString(),
        trackingStatus: `${this.state.displayedAircraft.length} aircraft tracked, positions updated`,
      });
    } catch (error) {
      this.props.onError(
        `Error refreshing positions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Restore the original fitBounds after a short delay
      setTimeout(() => {
        if (this.map && originalFitBounds) {
          this.map.fitBounds = originalFitBounds;
        }
      }, 2000);

      // Reset state - but wait a moment to make sure service has completed
      setTimeout(() => {
        this.setState({
          isRefreshing: false,
          preserveMapView: false,
        });
      }, 500);
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

          {mapMode === 'worker' && (
            <WorkerReactBaseMap
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

          {/* Map toggle buttons */}
          <div className="absolute top-4 right-4 z-50 flex space-x-2">
            <button
              onClick={() => this.toggleMapMode('legacy')}
              className={`px-3 py-1 rounded shadow-md text-sm ${
                mapMode === 'legacy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Legacy
            </button>
            <button
              onClick={() => this.toggleMapMode('react')}
              className={`px-3 py-1 rounded shadow-md text-sm ${
                mapMode === 'react'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              React
            </button>
            <button
              onClick={() => this.toggleMapMode('optimized')}
              className={`px-3 py-1 rounded shadow-md text-sm ${
                mapMode === 'optimized'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Optimized
            </button>
            <button
              onClick={() => this.toggleMapMode('worker')}
              className={`px-3 py-1 rounded shadow-md text-sm ${
                mapMode === 'worker'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Worker
            </button>
          </div>

          {/* Loading indicator */}
          {(isLoading || isRefreshing) && (
            <div className="absolute top-4 right-32 z-20">
              <LoadingSpinner
                message={
                  isRefreshing
                    ? 'Refreshing positions...'
                    : 'Loading aircraft data...'
                }
              />
            </div>
          )}

          {/* Your existing UI elements */}
          {/* ... */}
        </div>
      </MapProvider>
    );
  }
}

export default MapComponent;
