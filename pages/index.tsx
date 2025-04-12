// pages/index.tsx
import React from 'react';
import Head from 'next/head';
import { SelectOption } from '@/types/base';
import manufacturersService from '../lib/services/ManufacturersService';
import dynamic from 'next/dynamic';

interface HomePageProps {
  initialManufacturers?: SelectOption[];
}

interface HomePageState {
  manufacturers: SelectOption[];
  errorMessage: string | null;
}

const MapComponent = dynamic(
  () => import('../components/tracking/map/AircraftTrackingMap'),
  { ssr: false }
);

class HomePage extends React.Component<HomePageProps, HomePageState> {
  private unsubscribeManufacturers: (() => void) | null = null;

  constructor(props: HomePageProps) {
    super(props);

    this.state = {
      manufacturers: props.initialManufacturers || [],
      errorMessage: null,
    };

    this.handleError = this.handleError.bind(this);
    this.updateManufacturers = this.updateManufacturers.bind(this);
  }

  componentDidMount() {
    // Initialize service with SSR data first
    if (
      this.props.initialManufacturers &&
      this.props.initialManufacturers.length > 0
    ) {
      manufacturersService.initializeWithData(this.props.initialManufacturers);
    }

    // Subscribe to manufacturers updates
    this.unsubscribeManufacturers = manufacturersService.subscribe(
      this.updateManufacturers
    );

    // Load manufacturers if needed
    if (this.state.manufacturers.length === 0) {
      manufacturersService.loadManufacturers();
    }
  }

  componentWillUnmount() {
    // Cleanup subscription
    if (this.unsubscribeManufacturers) {
      this.unsubscribeManufacturers();
    }
  }

  // Update manufacturers state when service data changes
  updateManufacturers(manufacturers: SelectOption[]) {
    this.setState({ manufacturers });
  }

  // Handle error messages
  handleError(message: string) {
    this.setState({ errorMessage: message });

    // Auto-clear error after 5 seconds
    setTimeout(() => {
      this.setState({ errorMessage: null });
    }, 5000);
  }

  render() {
    const { manufacturers, errorMessage } = this.state;

    return (
      <>
        <Head>
          <title>Aircraft Tracking</title>
          <meta
            name="description"
            content="Track aircraft by manufacturer and model"
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main>
          <MapComponent
            manufacturers={manufacturers}
            onError={this.handleError}
          />

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

// Server-side props to pre-load manufacturers
export async function getServerSideProps() {
  try {
    // Use Node.js fetch for server-side data fetching
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tracking/manufacturers`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch manufacturers: ${response.statusText}`);
    }

    const manufacturers = await response.json();

    return {
      props: {
        initialManufacturers: manufacturers,
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);

    return {
      props: {
        initialManufacturers: [],
      },
    };
  }
}

export default HomePage;
