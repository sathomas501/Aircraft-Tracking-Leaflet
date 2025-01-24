// components/aircraft/tracking/Map/MapWrapper.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Aircraft } from '@/types/base';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { useOpenSkyPolling } from '@/hooks/useOpenSkyPolling';

const MapComponent = dynamic(() => import('./MapComponent'), {
    loading: () => <LoadingSpinner message="Loading map..." />,
    ssr: false,
});

const UnifiedSelector = dynamic(() => import('@/components/aircraft/selector/UnifiedSelector'), {
    loading: () => <LoadingSpinner message="Loading selector..." />,
    ssr: false,
});

export function MapWrapper() {
    const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [aircraft, setAircraft] = useState<Aircraft[]>([]);
    const [icao24List, setIcao24List] = useState<string[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { status: pollingStatus, error: pollingError } = useOpenSkyPolling({
        icao24List: icao24List.length > 0 ? icao24List : undefined,
        onData: setAircraft,
        onError: (err) => setError(err.message)
    });

    const filteredAircraft = useMemo(() => 
        selectedModel ? aircraft.filter(plane => plane.model === selectedModel) : aircraft,
    [aircraft, selectedModel]);

    const modelCounts = useMemo(() => {
        const counts = new Map();
        aircraft.forEach(plane => {
            if (plane.model) counts.set(plane.model, (counts.get(plane.model) || 0) + 1);
        });
        return counts;
    }, [aircraft]);

    const handleManufacturerSelect = useCallback(async (manufacturer: string) => {
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await fetch('/api/aircraft/track-manufacturer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manufacturer }),
            });

            if (!response.ok) throw new Error(response.statusText);
            
            const result = await response.json();
            setSelectedManufacturer(manufacturer);
            setIcao24List(result.icao24s || []);
            setAircraft(result.positions || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to track manufacturer');
            errorHandler.handleError(ErrorType.POLLING, err instanceof Error ? err : new Error('Polling failed'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    return (
        <div className="relative w-full h-screen">
            <div className="absolute inset-0 z-0">
                <MapComponent aircraft={filteredAircraft} />
            </div>
            
            <div className="absolute top-4 left-4 z-50">
                <button 
                    onClick={() => setIsSelectorOpen(prev => !prev)}
                    className="bg-white p-2 rounded-md shadow-lg hover:bg-gray-50"
                >
                    <Menu size={24} />
                </button>
            </div>

            {isSelectorOpen && (
                <div className="absolute top-16 left-4 z-50 w-80">
                    <UnifiedSelector
                        selectedType="manufacturer"
                        onManufacturerSelect={handleManufacturerSelect}
                        onModelSelect={setSelectedModel}
                        selectedManufacturer={selectedManufacturer}
                        selectedModel={selectedModel}
                        onAircraftUpdate={setAircraft}
                        modelCounts={modelCounts}
                        totalActive={aircraft.length}
                    />
                </div>
            )}

            {(error || pollingError) && (
                <div className="absolute top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                    {error || pollingError?.message}
                </div>
            )}

            {isLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                    <LoadingSpinner message="Loading aircraft data..." />
                </div>
            )}
        </div>
    );
}