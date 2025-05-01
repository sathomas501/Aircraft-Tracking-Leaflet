import * as React from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet.css';
import '@/styles/aircraftMapElements.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer, toast } from 'react-toastify';
import { EnhancedUIProvider } from '@/components/tracking/context/EnhancedUIContext';
import { EnhancedMapProvider } from '@/components/tracking/context/EnhancedMapContext';
import { LocationProvider } from '@/components/tracking/context/LocationContex';
import { DataPersistenceProvider } from '../components/tracking/persistence/DataPersistenceManager';

// Create a QueryClient instance with correct types
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1, // Retry failed queries once
      // Remove the onError property from queries config as it's not supported here
    },
  },
});

// Debug wrapper component to track initialization of context providers
const DebugProvider: React.FC<{
  name: string;
  children: React.ReactNode;
}> = ({ name, children }) => {
  React.useEffect(() => {
    console.log(`✅ ${name} provider mounted`);
    return () => {
      console.log(`🔄 ${name} provider unmounted`);
    };
  }, [name]);

  return <>{children}</>;
};

// Main App Component
export default function App({ Component, pageProps }: AppProps) {
  // Track app initialization time
  React.useEffect(() => {
    console.log('🚀 App component mounted at:', new Date().toISOString());

    // Add timeout to detect hangs
    const timeoutId = setTimeout(() => {
      console.warn(
        '⚠️ Possible initialization hang detected (5 seconds passed)'
      );
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      console.log('App component unmounted');
    };
  }, []);

  // Handle errors for the EnhancedMapProvider
  const handleMapError = React.useCallback((msg: string) => {
    console.error(`MapProvider Error: ${msg}`);
    toast.error(msg);
  }, []);

  // Track initial rendering
  console.log('📱 App rendering started at:', new Date().toISOString());

  return (
    <QueryClientProvider client={queryClient}>
      <EnhancedUIProvider>
        <DebugProvider name="EnhancedMapProvider">
          <EnhancedMapProvider
            manufacturers={[]} // Empty array as default
            onError={handleMapError} // Include the required onError prop
          >
            <DebugProvider name="LocationProvider">
              <LocationProvider>
                <DebugProvider name="DataPersistenceProvider">
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
                </DebugProvider>
              </LocationProvider>
            </DebugProvider>
          </EnhancedMapProvider>
        </DebugProvider>
      </EnhancedUIProvider>
    </QueryClientProvider>
  );
}
