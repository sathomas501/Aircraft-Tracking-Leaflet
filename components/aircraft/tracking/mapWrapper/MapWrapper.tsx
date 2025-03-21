// components/aircraft/tracking/mapWrapper/MapWrapper.tsx
import React from 'react';
import type { SelectOption, ExtendedAircraft, Aircraft } from '@/types/base';
import type { AircraftModel } from '@/types/aircraft-models';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import SimplifiedUnifiedSelector from '../selector/UnifiedSelector';
import icaoService from '@/lib/services/IcaoManagementService';

// Dynamic import for the map component
const DynamicMap = React.lazy(() => import('../Map/DynamicMap'));

export interface MapComponentProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

interface MapComponentState {
  displayedAircraft: ExtendedAircraft[];
  selectedManufacturer: string | null;
  selectedModel: string | null;
  models: AircraftModel[];
  isLoading: boolean;
  trackingStatus: string;
}

export class MapWrapper extends React.Component<
  MapComponentProps,
  MapComponentState
> {
  constructor(props: MapComponentProps) {
    super(props);

    console.log('MapWrapper constructor called');

    this.state = {
      displayedAircraft: [],
      selectedManufacturer: null,
      selectedModel: null,
      models: [],
      isLoading: false,
      trackingStatus: '',
    };

    // Bind methods
    this.handleManufacturerSelect = this.handleManufacturerSelect.bind(this);
    this.handleModelSelect = this.handleModelSelect.bind(this);
    this.handleReset = this.handleReset.bind(this);
    this.transformToExtendedAircraft =
      this.transformToExtendedAircraft.bind(this);
  }

  // Transform aircraft data to extended format
  transformToExtendedAircraft(aircraft: Aircraft[]): ExtendedAircraft[] {
    return aircraft.map((a: Aircraft) => ({
      ...a,
      type: a.TYPE_AIRCRAFT || 'Unknown',
      isGovernment: a.OWNER_TYPE === '5',
    })) as ExtendedAircraft[];
  }

  // Handle manufacturer selection
  async handleManufacturerSelect(manufacturer: string | null): Promise<void> {
    console.log(
      'MapWrapper.handleManufacturerSelect called with:',
      manufacturer
    );

    this.setState({
      selectedManufacturer: manufacturer,
      selectedModel: null,
      isLoading: true,
      trackingStatus: manufacturer
        ? `Loading aircraft for ${manufacturer}...`
        : '',
      models: [],
    });

    if (!manufacturer) {
      this.setState({
        displayedAircraft: [],
        models: [],
        isLoading: false,
        trackingStatus: '',
      });
      return;
    }

    try {
      // Get ICAO codes for this manufacturer
      const icaos = await icaoService.getIcao24sForManufacturer(manufacturer);
      console.log(`About to fetch ICAOs for ${manufacturer}`);
      if (icaos.length === 0) {
        this.props.onError(`No ICAO codes found for ${manufacturer}`);
        this.setState({
          isLoading: false,
          trackingStatus: `No aircraft found for ${manufacturer}`,
        });
        return;
      }

      // Track aircraft with these ICAO codes
      console.log(`About to track ${icaos.length} ICAOs`);
      // Is this line executed? Does trackAircraft actually run?
      const trackedAircraft = await icaoService.trackAircraft(
        icaos,
        manufacturer
      );
      console.log(`Received ${trackedAircraft.length} tracked aircraft`);
      const extendedAircraft =
        this.transformToExtendedAircraft(trackedAircraft);

      // Fetch models for this manufacturer
      this.setState({
        trackingStatus: `Loading models for ${manufacturer}...`,
      });

      const modelsResponse = await fetch(`/api/aircraft/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!modelsResponse.ok) {
        throw new Error('Failed to fetch models');
      }

      const modelsData = await modelsResponse.json();
      const models = modelsData.models || [];

      // Update state with all data
      this.setState({
        displayedAircraft: extendedAircraft,
        models,
        isLoading: false,
        trackingStatus: `Tracking ${extendedAircraft.length} aircraft for ${manufacturer}`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.props.onError(`Error loading data: ${errorMessage}`);
      this.setState({
        isLoading: false,
        trackingStatus: `Error tracking aircraft for ${manufacturer}`,
      });
    }
  }

  // Handle model selection
  handleModelSelect(model: string | null): void {
    this.setState({ selectedModel: model }, () => {
      this.filterAircraftByModel();
    });
  }

  // Filter aircraft by selected model
  filterAircraftByModel(): void {
    const { selectedModel } = this.state;

    if (!selectedModel) {
      // If no model selected, show all aircraft
      return;
    }

    const filtered = this.state.displayedAircraft.filter(
      (aircraft) =>
        aircraft.model === selectedModel ||
        aircraft.TYPE_AIRCRAFT === selectedModel
    );

    this.setState({
      displayedAircraft: filtered,
      trackingStatus: `Showing ${filtered.length} aircraft for model ${selectedModel}`,
    });
  }

  // Handle reset
  handleReset() {
    this.setState({
      selectedManufacturer: null,
      selectedModel: null,
      models: [],
    });
  }

  render() {
    const { manufacturers, onError } = this.props;
    const {
      displayedAircraft,
      selectedManufacturer,
      selectedModel,
      models,
      isLoading,
      trackingStatus,
    } = this.state;

    const totalActive = displayedAircraft.length;

    // Calculate model counts for the selector
    const modelCounts: Record<string, number> = {};
    models.forEach((model: AircraftModel) => {
      modelCounts[model.model] = model.activeCount || 0;
    });

    return (
      <div className="relative w-full h-screen">
        <React.Suspense fallback={<LoadingSpinner message="Loading map..." />}>
          <DynamicMap aircraft={displayedAircraft} onError={onError} />
        </React.Suspense>

        <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
          <SimplifiedUnifiedSelector
            manufacturers={manufacturers}
            selectedManufacturer={selectedManufacturer}
            activeModels={models}
            selectedModel={selectedModel}
            onManufacturerSelect={this.handleManufacturerSelect}
            onModelSelect={this.handleModelSelect}
            onReset={this.handleReset}
            totalActive={totalActive}
            isLoading={isLoading}
          />
        </div>

        {isLoading && (
          <div className="absolute top-4 right-4 z-20">
            <LoadingSpinner message="Loading aircraft data..." />
          </div>
        )}

        {trackingStatus && !isLoading && (
          <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
            <p className="text-sm">{trackingStatus}</p>
          </div>
        )}
      </div>
    );
  }
}

export default MapWrapper;
