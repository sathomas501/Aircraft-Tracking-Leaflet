// components/aircraft/tracking/Map/MapWrapper.tsx
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { AIRCRAFT } from '@/constants/aircraft';
import type { Aircraft } from '@/types/base';
import { openSkyIntegrated } from '@/lib/services/opensky-integrated';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';


const MapComponent = dynamic(() => import('./MapComponent'), {
    loading: () => <LoadingSpinner message="Loading map..." />,
    ssr: false,
});

const UnifiedSelector = dynamic(() => import('@/components/aircraft/selector/UnifiedSelector'), {
    loading: () => null,
    ssr: false,
});

export function MapWrapper() {
    const [selectedManufacturer, setSelectedManufacturer] = useState<string>(
        AIRCRAFT.DEFAULT_STATE.selectedManufacturer
    );
    const [selectedModel, setSelectedModel] = useState<string>(
        AIRCRAFT.DEFAULT_STATE.selectedModel
    );
    const [aircraft, setAircraft] = useState<Aircraft[]>([]);
    const [icao24List, setIcao24List] = useState<string[]>([]);
    const [isMapReady, setIsMapReady] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

     // Get error states with correct typing
     const networkError = errorHandler.useErrorHandler(ErrorType.NETWORK);
     const wsError = errorHandler.useErrorHandler(ErrorType.WEBSOCKET);
     const rateLimitError = errorHandler.useErrorHandler(ErrorType.RATE_LIMIT);
     const authError = errorHandler.useErrorHandler(ErrorType.AUTH);
 

    // Subscribe to aircraft updates
    useEffect(() => {
        if (!icao24List.length) return;

        const unsubscribe = openSkyIntegrated.subscribe((updatedAircraft) => {
            setAircraft(updatedAircraft);
            setIsLoading(false);
        });

        // Initial fetch
        openSkyIntegrated.getAircraft(icao24List);

        return () => unsubscribe();
    }, [icao24List]);

    const handleManufacturerSelect = useCallback(async (manufacturer: string) => {
        console.log('Manufacturer selected:', manufacturer);
        setSelectedManufacturer(manufacturer);
        setSelectedModel('');
        setAircraft([]);
        setIsLoading(true);

        try {
            const response = await fetch(`/api/aircraft/icao24s?manufacturer=${manufacturer}`);
            if (!response.ok) {
                throw new Error('Failed to fetch ICAO24 list');
            }
            
            const data = await response.json();
            if (data.icao24List?.length > 0) {
                setIcao24List(data.icao24List);
            } else {
                throw new Error('No aircraft found for this manufacturer');
            }
        } catch (error) {
            console.error('Error fetching ICAO24 list:', error);
            errorHandler.handleError(ErrorType.DATA, 'Failed to fetch aircraft list');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleModelSelect = useCallback((model: string) => {
        setSelectedModel(model);
    }, []);

    const toggleSelector = useCallback(() => {
        setIsSelectorOpen(prev => !prev);
    }, []);

    useEffect(() => {
        setIsMapReady(true);
    }, []);

   // Update getErrorMessage to handle null values safely
const getErrorMessage = (
  rateLimitError: ReturnType<typeof errorHandler.useErrorHandler>,
  authError: ReturnType<typeof errorHandler.useErrorHandler>,
  wsError: ReturnType<typeof errorHandler.useErrorHandler>,
  networkError: ReturnType<typeof errorHandler.useErrorHandler>
): string | null => {
  if (rateLimitError?.error) {
      return `Rate limit: ${rateLimitError.error.message}`;
  }
  if (authError?.error) {
      return 'Authentication failed. Some features may be limited.';
  }
  if ((wsError?.error && networkError?.error) || 
      (wsError?.error && networkError?.isRetrying)) {
      return 'Connection lost. Retrying...';
  }
  if (wsError?.error) {
      return 'Real-time updates temporarily unavailable';
  }
  return null;
};

    if (!isMapReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <LoadingSpinner message="Initializing map..." />
            </div>
        );
    }

    const errorMessage = getErrorMessage(rateLimitError, authError, wsError, networkError);

    return (
        <div className="relative w-full h-screen bg-gray-100">
            <div className="absolute inset-0">
                <MapComponent aircraft={aircraft} />
            </div>

            <div className="absolute top-4 left-4 z-[1000] flex items-start space-x-3">
                <button
                    onClick={toggleSelector}
                    className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-200"
                    title={isSelectorOpen ? 'Hide selector' : 'Show selector'}
                >
                    <Menu size={24} />
                </button>

                {isSelectorOpen && (
                    <UnifiedSelector
                        selectedType=""
                        onManufacturerSelect={handleManufacturerSelect}
                        onModelSelect={handleModelSelect}
                        selectedManufacturer={selectedManufacturer}
                        selectedModel={selectedModel}
                        onAircraftUpdate={setAircraft}
                    />
                )}
            </div>

            {isLoading && (
                <div className="absolute top-4 right-4 z-[1000]">
                    <LoadingSpinner message="Fetching aircraft data..." />
                </div>
            )}

{errorMessage && (
        <div className="absolute top-4 right-4 z-[1000] bg-red-100 text-red-700 px-4 py-2 rounded-lg">
            {errorMessage}
        </div>
    )}
            {!isLoading && !errorMessage && aircraft.length > 0 && (
                <div className="absolute top-4 right-4 z-[1000] bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                    {aircraft.length} active aircraft
                </div>
            )}
        </div>
    );
}