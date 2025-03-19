// components/Map/MapComponent.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import type { SelectOption, ExtendedAircraft } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import UnifiedSelector from '../selector/UnifiedSelector';
import aircraftTrackingService from '../../../../lib/services/tracking-services/AircraftTrackingService';

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
  trackingStatus: string;
}

class MapComponent extends React.Component<
  MapComponentProps,
  MapComponentState
> {
  // Aircraft data unsubscribe functions
  private unsubscribeAircraft: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;

  constructor(props: MapComponentProps) {
    super(props);

    this.state = {
      selectedManufacturer: null,
      selectedModel: null,
      displayedAircraft: [],
      isLoading: false,
      trackingStatus: '',
    };

    // Bind methods
    this.handleManufacturerSelect = this.handleManufacturerSelect.bind(this);
    this.handleModelSelect = this.handleModelSelect.bind(this);
    this.handleReset = this.handleReset.bind(this);
    this.updateAircraftDisplay = this.updateAircraftDisplay.bind(this);
    this.handleStatusUpdate = this.handleStatusUpdate.bind(this);
  }

  componentDidMount() {
    // Subscribe to aircraft updates
    this.unsubscribeAircraft = aircraftTrackingService.subscribeToAircraft(() =>
      this.updateAircraftDisplay()
    );

    // Subscribe to status updates
    this.unsubscribeStatus = aircraftTrackingService.subscribeToStatus(
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
  }

  // Handle manufacturer selection
  async handleManufacturerSelect(manufacturer: string | null) {
    this.setState({
      selectedManufacturer: manufacturer,
      selectedModel: null,
    });

    // Track the new manufacturer
    await aircraftTrackingService.trackManufacturer(manufacturer);
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
    const extendedAircraft = aircraftTrackingService.getExtendedAircraft(
      selectedModel || undefined
    );

    this.setState({
      displayedAircraft: extendedAircraft,
      isLoading: aircraftTrackingService.isLoading(),
    });
  }

  // Handle status updates
  handleStatusUpdate(status: string) {
    this.setState({
      trackingStatus: status,
      isLoading: aircraftTrackingService.isLoading(),
    });
  }

  render() {
    const { manufacturers, onError } = this.props;
    const {
      selectedManufacturer,
      selectedModel,
      displayedAircraft,
      isLoading,
      trackingStatus,
    } = this.state;

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
        {isLoading && (
          <div className="absolute top-4 right-4 z-20">
            <LoadingSpinner message="Loading aircraft data..." />
          </div>
        )}

        {/* Status message */}
        {trackingStatus && !isLoading && (
          <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
            <p className="text-sm">{trackingStatus}</p>
          </div>
        )}
      </div>
    );
  }
}

export default MapComponent;
