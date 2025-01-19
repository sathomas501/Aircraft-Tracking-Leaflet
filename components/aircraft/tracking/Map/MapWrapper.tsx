// components/aircraft/tracking/Map/MapWrapper.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { AIRCRAFT } from '@/constants/aircraft';
import type { Aircraft } from '@/types/base';
import { openSkyIntegrated } from '@/lib/services/opensky-integrated/opensky-integrated';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';

const MapComponent = dynamic(() => import('./MapComponent'), {
    loading: () => <LoadingSpinner message="Loading map..." />,
    ssr: false,
});

const UnifiedSelector = dynamic(() => import('@/components/aircraft/selector/UnifiedSelector'), {
    loading: () => null,
    ssr: false,
});

interface ActiveCounts {
    active: number;
    total: number;
}
interface Manufacturer {
    value: string;
    label: string;
    activeCount?: number;
}
export function MapWrapper() {
    // All state hooks
    const [selectedManufacturer, setSelectedManufacturer] = useState<string>(
        AIRCRAFT.DEFAULT_STATE.selectedManufacturer
    );
    const [selectedModel, setSelectedModel] = useState<string>(
        AIRCRAFT.DEFAULT_STATE.selectedModel
    );
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [aircraft, setAircraft] = useState<Aircraft[]>([]);
    const [icao24List, setIcao24List] = useState<string[]>([]);
    const [isMapReady, setIsMapReady] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [activeCounts, setActiveCounts] = useState<ActiveCounts>({ active: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);


    // Error handlers
    const networkError = errorHandler.useErrorHandler(ErrorType.NETWORK);
    const wsError = errorHandler.useErrorHandler(ErrorType.WEBSOCKET);
    const rateLimitError = errorHandler.useErrorHandler(ErrorType.RATE_LIMIT);
    const authError = errorHandler.useErrorHandler(ErrorType.AUTH);

    // All useMemo hooks
    const filteredAircraft = useMemo(() => {
        if (!selectedModel) {
            return aircraft;
        }
        return aircraft.filter(plane => plane.model === selectedModel);
    }, [aircraft, selectedModel]);

    const modelCounts = useMemo(() => {
        const counts = new Map();
        aircraft.forEach(plane => {
            if (plane.model) {
                const current = counts.get(plane.model) || 0;
                counts.set(plane.model, current + 1);
            }
        });
        return counts;
    }, [aircraft]);

    // All useEffect hooks
    useEffect(() => {
        setIsMapReady(true);
    }, []);

    useEffect(() => {
        if (!icao24List.length) return;

        const unsubscribe = openSkyIntegrated.subscribe((updatedAircraft) => {
            setAircraft(updatedAircraft);
            setIsLoading(false);
            setActiveCounts(prev => ({
                ...prev,
                active: updatedAircraft.length
            }));
        });

    
    // Initial fetch
    openSkyIntegrated.getAircraft(icao24List);

    return () => unsubscribe();
}, [icao24List]);

const [trackingStatus, setTrackingStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');


// All callback functions
const handleManufacturerSelect = useCallback(async (manufacturer: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
        const response = await fetch('/api/aircraft/track-manufacturer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ manufacturer })
        });

        if (!response.ok) {
            throw new Error(`Failed to track manufacturer: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success) {
            setSelectedManufacturer(manufacturer);
            if (result.activeCount !== undefined) {
                setManufacturers(prev => 
                    prev.map((m: Manufacturer) => 
                        m.value === manufacturer 
                            ? { ...m, activeCount: result.activeCount }
                            : m
                    )
                );
                setActiveCounts({
                    active: result.activeCount,
                    total: result.totalCount || 0
                });
            }
            if (result.icao24s) {
                setIcao24List(result.icao24s);
            }
        } else {
            throw new Error(result.message || 'Failed to track manufacturer');
        }
    } catch (err) {
        errorHandler.handleError(ErrorType.DATA, 'Failed to track manufacturer');
        setError(err instanceof Error ? err.message : 'Failed to track manufacturer');
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
                <MapComponent aircraft={filteredAircraft} />
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
        modelCounts={modelCounts} // Add this prop
        totalActive={aircraft.length} // Add this prop
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

            {!isLoading && !errorMessage && filteredAircraft.length > 0 && (
                <div className="absolute top-4 right-4 z-[1000] bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                    {filteredAircraft.length} active aircraft
                    {selectedModel && ` (${selectedModel})`}
                </div>
            )}

{isLoading && (
                <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                        <LoadingSpinner />
                        <div>
                            <p className="font-medium">Tracking {selectedManufacturer}</p>
                            <p className="text-sm text-gray-500">Getting active aircraft positions...</p>
                        </div>
                    </div>
                </div>
            )}

            {!isLoading && trackingStatus === 'complete' && !errorMessage && filteredAircraft.length > 0 && (
                <div className="absolute top-4 right-4 z-[1000] bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                    {filteredAircraft.length} active aircraft
                    {selectedModel && ` (${selectedModel})`}
                </div>
            )}

            {trackingStatus === 'error' && (
                <div className="absolute top-4 right-4 z-[1000] bg-red-100 text-red-700 px-4 py-2 rounded-lg">
                    Failed to track aircraft. Please try again.
                </div>
            )}
        </div>

        
    );
}