// pages/index.tsx
import React from 'react';
import Head from 'next/head';
import { SelectOption } from '@/types/base';
import { manufacturersService } from '../lib/services/ManufacturersService';
import dynamic from 'next/dynamic';

// Define RegionCode enum
export enum RegionCode {
  GLOBAL = 0,
  NORTH_AMERICA = 1,
  // Add other regions as needed
}

interface HomePageProps {
  // No initial manufacturers - they'll be loaded after region selection
}

interface HomePageState {
  manufacturers: SelectOption[];
  errorMessage: string | null;
  selectedRegion: RegionCode | null; // Can be null before selection
  isLoading: boolean;
  showRegionSelector: boolean;
}

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
      <p>Loading aircraft tracking data...</p>
    </div>
  </div>
);

// Dynamically import the map with a loading fallback
const MapComponent = dynamic(
  () => import('../components/tracking/map/AircraftTrackingMap'),
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
);

class HomePage extends React.Component<HomePageProps, HomePageState> {
  private unsubscribeManufacturers: (() => void) | null = null;
  private initTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: HomePageProps) {
    super(props);

    console.log('HomePage constructor executed');

    this.state = {
      manufacturers: [],
      errorMessage: null,
      selectedRegion: null, // Start with no region selected
      isLoading: false, // Not loading initially as we're showing region selector
      showRegionSelector: true, // Show region selector initially
    };

    this.handleError = this.handleError.bind(this);
    this.updateManufacturers = this.updateManufacturers.bind(this);
    this.selectRegion = this.selectRegion.bind(this);
  }

  componentDidMount() {
    console.log('HomePage componentDidMount started');

    // Subscribe to manufacturers updates
    try {
      this.unsubscribeManufacturers = manufacturersService.subscribe(
        this.updateManufacturers
      );
      console.log('Subscribed to manufacturer updates');
    } catch (error) {
      console.error('Error subscribing to manufacturers:', error);
      this.handleError(
        `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    console.log('HomePage componentDidMount completed');
  }

  componentWillUnmount() {
    console.log('HomePage unmounting');
    // Cleanup subscription
    if (this.unsubscribeManufacturers) {
      this.unsubscribeManufacturers();
      console.log('Unsubscribed from manufacturer updates');
    }

    // Clear timeout
    if (this.initTimeoutId) {
      clearTimeout(this.initTimeoutId);
    }
  }

  // Handle region selection
  selectRegion(region: RegionCode) {
    console.log(`Region selected: ${region}`);

    this.setState({
      selectedRegion: region,
      isLoading: true,
      showRegionSelector: false,
    });

    // Set a timeout to detect data loading hangs
    this.initTimeoutId = setTimeout(() => {
      console.warn(
        '⚠️ Manufacturer loading may be hanging (took over 5 seconds)'
      );
      this.setState({
        isLoading: false,
        errorMessage:
          'Data loading is taking longer than expected. Try selecting a different region or refresh the page.',
      });
    }, 5000);

    // Load manufacturers for the selected region
    try {
      console.log(`Loading manufacturers for region: ${region}`);
      manufacturersService.loadManufacturers(region);
      console.log('Manufacturer loading initiated');
    } catch (error) {
      console.error('Error loading manufacturers:', error);
      this.handleError(
        `Failed to load manufacturers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.setState({ isLoading: false });
    }
  }

  // Update manufacturers state when service data changes
  updateManufacturers(manufacturers: SelectOption[]) {
    console.log(`Received ${manufacturers.length} manufacturers from service`);
    this.setState({
      manufacturers,
      isLoading: false,
    });

    // Clear initialization timeout if it's still running
    if (this.initTimeoutId) {
      clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
  }

  // Handle error messages
  handleError(message: string) {
    console.error(`Error occurred: ${message}`);
    this.setState({ errorMessage: message });

    // Auto-clear error after 5 seconds
    setTimeout(() => {
      this.setState({ errorMessage: null });
    }, 5000);
  }

  render() {
    const {
      manufacturers,
      errorMessage,
      isLoading,
      showRegionSelector,
      selectedRegion,
    } = this.state;
    console.log(
      `HomePage rendering - showRegionSelector=${showRegionSelector}, isLoading=${isLoading}, manufacturers=${manufacturers.length}`
    );

    return (
      <>
        <Head>
          <title>Aircraft Tracking</title>
          <meta
            name="description"
            content="Track aircraft by MANUFACTURER and MODEL"
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className="min-h-screen">
          {/* Loading state */}
          {isLoading && <LoadingSpinner />}

          <MapComponent
            manufacturers={manufacturers}
            selectedRegion={selectedRegion}
            onError={this.handleError}
          />

          {showRegionSelector && (
            <div className="fixed inset-0 bg-white bg-opacity-90 z-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-center">
                <h2 className="text-xl font-semibold mb-4">
                  Select a region to begin
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
                    onClick={() => this.selectRegion(RegionCode.NORTH_AMERICA)}
                  >
                    North America
                  </button>
                  <button
                    className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
                    onClick={() => this.selectRegion(RegionCode.GLOBAL)}
                  >
                    Global
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error notification */}
          {errorMessage && (
            <div className="fixed bottom-4 left-4 bg-red-500 text-white p-3 rounded-md shadow-lg z-50">
              <p>{errorMessage}</p>
            </div>
          )}
        </main>
      </>
    );
  }
}

// No longer need getServerSideProps since we're loading data after region selection
export default HomePage;
