import { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initializeApp } from '../server/init';

const queryClient = new QueryClient();

if (typeof window === 'undefined') {
    (async () => {
        try {
            await initializeApp();
            console.log('[App] Application initialized successfully.');
        } catch (error) {
            console.error('[App] Failed to initialize application:', error);
        }
    })();
}

export default function MyApp({ Component, pageProps }: AppProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <Component {...pageProps} />
        </QueryClientProvider>
    );
}
