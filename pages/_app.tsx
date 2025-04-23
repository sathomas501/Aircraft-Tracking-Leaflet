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
          manufacturers={[]} // Provide your manufacturers or get them dynamically
          onError={(msg) => toast.error(msg)}
        >
          <LocationProvider>
            {' '}
            {/* ✅ Add LocationProvider here */}
            <DataPersistenceProvider>
              <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={true}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
              />
              <Component {...pageProps} />
            </DataPersistenceProvider>
          </LocationProvider>
        </EnhancedMapProvider>
      </EnhancedUIProvider>
    </QueryClientProvider>
  );
}
