import * as React from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet.css';
import '@/styles/aircraftMapElements.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer, toast } from 'react-toastify';
import { Toaster } from 'react-hot-toast';
import { EnhancedUIProvider } from '@/components/tracking/context/EnhancedUIContext';
import { EnhancedMapProvider } from '@/components/tracking/context/EnhancedMapContext';
import { LocationProvider } from '@/components/tracking/context/LocationContex';
import { DataPersistenceProvider } from '../components/tracking/persistence/DataPersistenceManager';
import { FilterProvider } from '@/components/tracking/context/FilterContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right" />
    </>
  );
}

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1, // Retry failed queries once
    },
  },
});

// Main App Component
export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <EnhancedUIProvider>
        <EnhancedMapProvider
          manufacturers={[]}
          onError={(msg) => toast.error(msg)}
        >
          <LocationProvider>
            <DataPersistenceProvider>
              <FilterProvider>
                {' '}
                {/* Add this provider */}
                <ToastContainer />
                <Component {...pageProps} />
              </FilterProvider>
            </DataPersistenceProvider>
          </LocationProvider>
        </EnhancedMapProvider>
      </EnhancedUIProvider>
    </QueryClientProvider>
  );
}
