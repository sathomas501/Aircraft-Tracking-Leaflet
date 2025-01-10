import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Aircraft } from '@/types/base';
import { AIRCRAFT } from '@/constants/aircraft';

// Dynamically import components
const MapComponent = dynamic(() => import('./MapComponent'), {
  loading: () => <LoadingSpinner message="Loading map..." />,
  ssr: false,
});

const UnifiedSelector = dynamic(() => import('@/components/aircraft/selector/UnifiedSelector'), {
  loading: () => null,
  ssr: false,
});

interface AircraftState {
  selectedManufacturer: string;
  selectedModel: string;
  selectedType: string;
  selectedAircraftId: string | null;
}

export function MapWrapper() {
  // State management
  const [selectedManufacturer, setSelectedManufacturer] = useState<AircraftState['selectedManufacturer']>(
    AIRCRAFT.DEFAULT_STATE.selectedManufacturer
  );
  const [selectedModel, setSelectedModel] = useState<AircraftState['selectedModel']>(
    AIRCRAFT.DEFAULT_STATE.selectedModel
  );
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [icao24List, setIcao24List] = useState<string[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for managing async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMounted = useRef(true);

  // Initialize WebSocket connection
  const initWebSocket = useCallback(() => {
    if (icao24List.length === 0) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${window.location.protocol.replace('http', 'ws')}//${window.location.host}/api/opensky`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      if (icao24List.length > 0) {
        ws.send(JSON.stringify({ type: 'subscribe', icao24s: icao24List }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (isMounted.current) {
          setAircraft(prevAircraft => {
            const newAircraft = Array.isArray(data) ? data : [data];
            return newAircraft.map(pos => ({
              ...pos,
              altitude: pos.altitude || 0,
              velocity: pos.velocity || 0,
              on_ground: pos.on_ground || false,
            }));
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (isMounted.current) {
        setError('WebSocket connection error');
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      wsRef.current = null;
      // Fallback to REST API
      if (isMounted.current) {
        fetchPositionsREST();
      }
    };

    wsRef.current = ws;
  }, [icao24List]);

  // Fetch positions using REST API
  const fetchPositionsREST = useCallback(async () => {
    if (icao24List.length === 0) return;

    try {
      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/opensky?icao24s=${icao24List.join(',')}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch aircraft positions');
      }

      const positions = await response.json();

      if (isMounted.current) {
        setAircraft(Array.isArray(positions) ? positions : [positions]);
        setIsLoading(false);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching positions:', error);
      if (isMounted.current) {
        setError('Failed to fetch aircraft positions');
        setIsLoading(false);
      }
    }
  }, [icao24List]);

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(async (manufacturer: string) => {
    console.log('Manufacturer selected:', manufacturer);
    setSelectedManufacturer(manufacturer);
    setSelectedModel('');
    setIcao24List([]);
    setAircraft([]);
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/aircraft/icao24s?manufacturer=${manufacturer}`);
      if (!response.ok) {
        throw new Error('Failed to fetch ICAO24 list');
      }
      const data = await response.json();
      if (isMounted.current) {
        setIcao24List(data.icao24List || []);
      }
    } catch (error) {
      console.error('Error fetching ICAO24 list:', error);
      if (isMounted.current) {
        setError('Failed to fetch aircraft list');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Handle model selection
  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  // Toggle selector visibility
  const toggleSelector = useCallback(() => {
    setIsSelectorOpen(prev => !prev);
  }, []);

  // Initialize map and setup cleanup
  useEffect(() => {
    setIsMapReady(true);
    return () => {
      isMounted.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Setup WebSocket or REST API fetching
  useEffect(() => {
    if (icao24List.length > 0) {
      initWebSocket();
      // Fetch initial data
      fetchPositionsREST();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [icao24List, initWebSocket, fetchPositionsREST]);

  if (!isMapReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner message="Initializing map..." />
      </div>
    );
  }

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

      {error && (
        <div className="absolute top-4 right-4 z-[1000] bg-red-100 text-red-700 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}