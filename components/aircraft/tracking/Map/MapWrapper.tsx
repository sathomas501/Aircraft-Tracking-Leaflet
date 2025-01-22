// components/aircraft/tracking/Map/MapWrapper.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { AIRCRAFT } from '@/constants/aircraft';
import type { Aircraft } from '@/types/base';
import { openSkyIntegrated } from '@/lib/services/opensky-integrated/opensky-integrated';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';

// Dynamic imports
const MapComponent = dynamic(() => import('./MapComponent'), {
    loading: () => <LoadingSpinner message="Loading map..." />,
    ssr: false,
});

const UnifiedSelector = dynamic(() => import('@/components/aircraft/selector/UnifiedSelector'), {
    loading: () => null,
    ssr: false,
});

// Types
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
    // State hooks
    const [selectedManufacturer, setSelectedManufacturer] = useState<string>(AIRCRAFT.DEFAULT_STATE.selectedManufacturer);
    const [selectedModel, setSelectedModel] = useState<string>(AIRCRAFT.DEFAULT_STATE.selectedModel);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [aircraft, setAircraft] = useState<Aircraft[]>([]);
    const [icao24List, setIcao24List] = useState<string[]>([]);
    const [isMapReady, setIsMapReady] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [activeCounts, setActiveCounts] = useState<ActiveCounts>({ active: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const [trackingStatus, setTrackingStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');

    // Error handlers
    const networkError = errorHandler.useErrorHandler(ErrorType.NETWORK);
    const wsError = errorHandler.useErrorHandler(ErrorType.WEBSOCKET);
    const rateLimitError = errorHandler.useErrorHandler(ErrorType.RATE_LIMIT);
    const authError = errorHandler.useErrorHandler(ErrorType.AUTH);

    // Memoized values
    const filteredAircraft = useMemo(() => {
        if (!selectedModel) return aircraft;
        return aircraft.filter((plane) => plane.model === selectedModel);
    }, [aircraft, selectedModel]);

    const modelCounts = useMemo(() => {
        const counts = new Map();
        aircraft.forEach((plane) => {
            if (plane.model) {
                const current = counts.get(plane.model) || 0;
                counts.set(plane.model, current + 1);
            }
        });
        return counts;
    }, [aircraft]);

    // Callback functions
    const handleManufacturerSelect = useCallback(async (manufacturer: string) => {
        setIsLoading(true);
        setError(null);
        setTrackingStatus('loading');

        try {
            const response = await fetch('/api/aircraft/track-manufacturer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manufacturer }),
            });

            if (!response.ok) throw new Error(`Failed to track manufacturer: ${response.statusText}`);

            const result = await response.json();

            if (result.success) {
                setSelectedManufacturer(manufacturer);
                setManufacturers((prev) =>
                    prev.map((m) => (m.value === manufacturer ? { ...m, activeCount: result.activeCount } : m))
                );
                setActiveCounts({ active: result.activeCount, total: result.totalCount || 0 });
                setIcao24List(result.icao24s || []);
                setTrackingStatus('complete');
            } else {
                throw new Error(result.message || 'Failed to track manufacturer');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to track manufacturer');
            setTrackingStatus('error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleModelSelect = useCallback((model: string) => {
        setSelectedModel(model);
    }, []);

    const toggleSelector = useCallback(() => {
        setIsSelectorOpen((prev) => !prev);
    }, []);

    // Effects
    useEffect(() => {
        setIsMapReady(true);
    }, []);

    useEffect(() => {
        if (!icao24List.length) return;

        const unsubscribe = openSkyIntegrated.subscribe((updatedAircraft) => {
            setAircraft(updatedAircraft);
            setIsLoading(false);
            setActiveCounts((prev) => ({ ...prev, active: updatedAircraft.length }));
        });

        openSkyIntegrated.getAircraft(icao24List);
        return () => unsubscribe();
    }, [icao24List]);

    const getErrorMessage = (): string | null => {
        if (rateLimitError?.error) return `Rate limit: ${rateLimitError.error.message}`;
        if (authError?.error) return 'Authentication failed. Some features may be limited.';
        if (wsError?.error && networkError?.error) return 'Connection lost. Retrying...';
        if (wsError?.error) return 'Real-time updates temporarily unavailable';
        return null;
    };

    if (!isMapReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <LoadingSpinner message="Initializing map..." />
            </div>
        );
    }

    const errorMessage = getErrorMessage();

    return (
        <div className="relative w-full h-screen bg-gray-100">
            <div className="absolute inset-0">
                <MapComponent aircraft={filteredAircraft} />
            </div>
            <div className="absolute top-4 left-4 z-[1000]">
                <button onClick={toggleSelector} className="bg-white p-2 rounded shadow">
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
                    modelCounts={modelCounts}
                    totalActive={aircraft.length}
                />
                )}
            </div>
            {errorMessage && <div>{errorMessage}</div>}
        </div>
    );
}
