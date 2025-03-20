// components/Map/MapComponent.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import type { SelectOption, ExtendedAircraft } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import UnifiedSelector from '../selector/UnifiedSelector';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

// Dynamically import the map to avoid SSR issues with Leaflet
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

interface MapComponentProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

interface MapComponentState {
  selectedManufacturer: string | null;
  selectedModel: string | null;
  displayedAircraft: ExtendedAircraft[];
  isLoading: boolean;
  isRefreshing: boolean;
  trackingStatus: string;
  lastRefreshed: string | null;
  modelStats: {
    totalActive: number;
    totalInactive: number;
  };
}

class MapComponent extends React.Component<
  MapComponentProps,
  MapComponentState
> {
  // Aircraft data unsubscribe functions
  private unsubscribeAircraft: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(props: MapComponentProps) {
    super(props);

    this.state = {
      selectedManufacturer: null,
      selectedModel: null,
      displayedAircraft: [],
      isLoading: false,
      isRefreshing: false,
      trackingStatus: '',
      lastRefreshed: null,
      modelStats: {
        totalActive: 0,
        totalInactive: 0,
      },
    };

    // Bind methods
    this.handleManufacturerSelect = this.handleManufacturerSelect.bind(this);
    this.handleModelSelect = this.handleModelSelect.bind(this);
    this.handleReset = this.handleReset.bind(this);
    this.updateAircraftDisplay = this.updateAircraftDisplay.bind(this);
    this.handleStatusUpdate = this.handleStatusUpdate.bind(this);
    this.refreshPositionsOnly = this.refreshPositionsOnly.bind(this);
    this.handleFullRefresh = this.handleFullRefresh.bind(this);
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
    const extendedAircraft = openSkyTrackingService.getExtendedAircraft(
      selectedModel || undefined
    );

    // Get model stats from the service
    const { totalActive, totalInactive } =
      openSkyTrackingService.getModelStats();

    this.setState({
      displayedAircraft: extendedAircraft,
      isLoading: openSkyTrackingService.isLoading(),
      modelStats: { totalActive, totalInactive },
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
    });

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
    } catch (error) {
      this.props.onError(
        `Error refreshing positions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.setState({ isRefreshing: false });
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

  render() {
    const { manufacturers, onError } = this.props;
    const {
      selectedManufacturer,
      selectedModel,
      displayedAircraft,
      isLoading,
      isRefreshing,
      trackingStatus,
      lastRefreshed,
    } = this.state;

    const isTrackingActive =
      selectedManufacturer !== null && displayedAircraft.length > 0;

    return (
      <div className="relative w-full h-screen">
        {/* Map component */}
        <LeafletMap aircraft={displayedAircraft} onError={onError} />

        {/* Aircraft selector */}
        <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
          <UnifiedSelector
            manufacturers={manufacturers}
            onManufacturerSelect={this.handleManufacturerSelect}
            onModelSelect={this.handleModelSelect}
            onReset={this.handleReset}
            totalActive={displayedAircraft.length}
            isLoading={isLoading}
          />
        </div>

        {/* Loading indicator */}
        {(isLoading || isRefreshing) && (
          <div className="absolute top-4 right-4 z-20">
            <LoadingSpinner
              message={
                isRefreshing
                  ? 'Refreshing positions...'
                  : 'Loading aircraft data...'
              }
            />
          </div>
        )}

        {/* Refresh controls */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
          {/* Position-only refresh button */}
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

          {/* Full refresh button */}
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

        {/* Status and last refresh info */}
        <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
          <p className="text-sm">{trackingStatus}</p>
          {lastRefreshed && (
            <p className="text-xs text-gray-600">
              Last updated: {lastRefreshed}
            </p>
          )}
        </div>
      </div>
    );
  }
}

export default MapComponent;
