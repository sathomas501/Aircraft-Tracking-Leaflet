import * as React from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet.css';
import '@/server/init'; // Ensure init.ts runs

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

export default function App({ Component, pageProps }: AppProps) {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(Component, { ...pageProps })
  );
}