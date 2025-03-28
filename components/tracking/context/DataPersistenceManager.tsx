// components/tracking/context/DataPersistenceManager.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Aircraft, ExtendedAircraft, CachedAircraftData } from '@/types/base';
import {
  saveAircraftData,
  loadAircraftData,
  mergeAircraftData,
  clearAircraftData,
  saveMapState,
  loadMapState,
  saveSelectedAircraft,
  loadSelectedAircraft,
  saveTrailState,
  loadTrailState,
  getSessionId,
} from '../../../utils/AircraftDataPersistance';

// Define Trail Position type
interface TrailPosition {
  lat: number;
  lng: number;
  alt: number | null;
  timestamp: number;
}

// Define context interface
interface DataPersistenceContextType {
  // Aircraft data
  cachedAircraft: Record<string, CachedAircraftData>;
  updateAircraftCache: (aircraft: ExtendedAircraft[]) => void;
  getEnhancedAircraft: (aircraft: ExtendedAircraft) => ExtendedAircraft;
  clearCache: () => void;

  // Map state
  saveMapPosition: (center: [number, number], zoom: number) => void;
  getInitialMapState: () => { center: [number, number]; zoom: number } | null;

  // Selected aircraft
  saveSelectedAircraftId: (icao: string | null) => void;
  getSelectedAircraftId: () => string | null;

  // Trail state
  saveTrails: (
    enabled: boolean,
    maxLength: number,
    trails: Map<string, TrailPosition[]>
  ) => void;
  getInitialTrailState: () => {
    enabled: boolean;
    maxLength: number;
    trails: Map<string, TrailPosition[]>;
  } | null;

  // Debug info
  cacheSize: number;
  lastUpdated: number | null;
  sessionId: string;
}

// Create context
const DataPersistenceContext = createContext<
  DataPersistenceContextType | undefined
>(undefined);

// Provider component
export const DataPersistenceProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // State for cached aircraft data
  const [cachedAircraft, setCachedAircraft] = useState<
    Record<string, CachedAircraftData>
  >({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>('temp_session');

  // Initialize session ID after component mounts (client-side only)
  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  // Load data on initial mount
  useEffect(() => {
    // Load cached aircraft data
    const savedData = loadAircraftData();
    if (savedData && Object.keys(savedData).length > 0) {
      setCachedAircraft(savedData);
      setCacheSize(Object.keys(savedData).length);
      setLastUpdated(Date.now());
      console.log(
        `[DataPersistence] Loaded ${Object.keys(savedData).length} aircraft from storage`
      );
    }
  }, []);

  // Update aircraft cache with new data
  const updateAircraftCache = useCallback(
    (aircraftList: ExtendedAircraft[]) => {
      if (!aircraftList || aircraftList.length === 0) return;

      setCachedAircraft((prevCache) => {
        // Convert aircraft array to record format
        const currentData: Record<string, CachedAircraftData> = {};

        aircraftList.forEach((aircraft) => {
          if (aircraft.icao24) {
            // Convert to CachedAircraftData format
            currentData[aircraft.icao24] = {
              ...aircraft,
              icao24: aircraft.icao24,
              lastUpdated: Date.now(),
              // Ensure required fields are present with default values
              latitude: aircraft.latitude || 0,
              longitude: aircraft.longitude || 0,
              altitude: aircraft.altitude || 0,
              velocity: aircraft.velocity || 0,
              heading: aircraft.heading || 0,
              on_ground: aircraft.on_ground || false,
              last_contact: aircraft.last_contact || Date.now(),
            } as CachedAircraftData;
          }
        });

        // Merge with existing cached data
        const mergedData = mergeAircraftData(prevCache, currentData);

        // Save to localStorage
        saveAircraftData(mergedData);

        // Update cache stats
        setCacheSize(Object.keys(mergedData).length);
        setLastUpdated(Date.now());

        return mergedData;
      });
    },
    []
  );

  // Get enhanced aircraft with cached data
  const getEnhancedAircraft = useCallback(
    (aircraft: ExtendedAircraft): ExtendedAircraft => {
      if (!aircraft.icao24 || !cachedAircraft[aircraft.icao24]) {
        return aircraft;
      }

      const cached = cachedAircraft[aircraft.icao24];

      // Start with current aircraft data (for latest position)
      const enhanced = { ...aircraft };

      // Add missing fields from cache (only if they're empty in current data)
      const staticFields: Array<keyof CachedAircraftData> = [
        'registration',
        'model',
        'manufacturer',
        'N-NUMBER',
        'TYPE_AIRCRAFT',
        'NAME',
        'OWNER_TYPE',
        'CITY',
        'STATE',
      ];

      staticFields.forEach((field) => {
        if (
          (!enhanced[field as keyof ExtendedAircraft] ||
            enhanced[field as keyof ExtendedAircraft] === '') &&
          cached[field]
        ) {
          (enhanced as any)[field] = cached[field];
        }
      });

      // Ensure ExtendedAircraft required fields are present
      enhanced.type = enhanced.type || enhanced.TYPE_AIRCRAFT || 'unknown';
      enhanced.isGovernment =
        enhanced.isGovernment || enhanced.OWNER_TYPE === 'GOVERNMENT';
      enhanced.isTracked =
        enhanced.isTracked !== undefined ? enhanced.isTracked : true;

      return enhanced;
    },
    [cachedAircraft]
  );

  // Clear the cache
  const clearCache = useCallback(() => {
    clearAircraftData();
    setCachedAircraft({});
    setCacheSize(0);
    setLastUpdated(null);
    console.log('[DataPersistence] Cache cleared');
  }, []);

  // Save map position
  const saveMapPosition = useCallback(
    (center: [number, number], zoom: number) => {
      saveMapState(center, zoom);
    },
    []
  );

  // Get initial map state
  const getInitialMapState = useCallback(() => {
    return loadMapState();
  }, []);

  // Save selected aircraft
  const saveSelectedAircraftId = useCallback((icao: string | null) => {
    saveSelectedAircraft(icao);
  }, []);

  // Get selected aircraft
  const getSelectedAircraftId = useCallback(() => {
    return loadSelectedAircraft();
  }, []);

  // Save trails
  const saveTrails = useCallback(
    (
      enabled: boolean,
      maxLength: number,
      trails: Map<string, TrailPosition[]>
    ) => {
      // Convert Map to Record for storage
      const trailsRecord: Record<string, TrailPosition[]> = {};
      trails.forEach((positions, icao) => {
        trailsRecord[icao] = positions;
      });

      saveTrailState({
        enabled,
        maxLength,
        trails: trailsRecord,
        lastUpdated: Date.now(),
      });
    },
    []
  );

  // Get initial trail state
  const getInitialTrailState = useCallback(() => {
    const state = loadTrailState();
    if (!state) return null;

    // Convert Record back to Map
    const trailsMap = new Map<string, TrailPosition[]>();
    Object.entries(state.trails).forEach(([icao, positions]) => {
      trailsMap.set(icao, positions);
    });

    return {
      enabled: state.enabled,
      maxLength: state.maxLength,
      trails: trailsMap,
    };
  }, []);

  // Create context value
  const contextValue: DataPersistenceContextType = {
    cachedAircraft,
    updateAircraftCache,
    getEnhancedAircraft,
    clearCache,
    saveMapPosition,
    getInitialMapState,
    saveSelectedAircraftId,
    getSelectedAircraftId,
    saveTrails,
    getInitialTrailState,
    cacheSize,
    lastUpdated,
    sessionId,
  };

  return (
    <DataPersistenceContext.Provider value={contextValue}>
      {children}
    </DataPersistenceContext.Provider>
  );
};

// Custom hook to use the context
export const useDataPersistence = () => {
  const context = useContext(DataPersistenceContext);
  if (context === undefined) {
    throw new Error(
      'useDataPersistence must be used within a DataPersistenceProvider'
    );
  }
  return context;
};

export default DataPersistenceContext;
