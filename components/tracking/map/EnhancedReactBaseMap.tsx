// components/tracking/map/EnhancedReactBaseMap.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  MapContainer,
  useMapEvents,
  TileLayer,
  useMap,
  LayersControl,
  ZoomControl,
  Circle, // Add this import
  Popup, // Add this if you're using Popup
} from 'react-leaflet';
import { MAP_CONFIG } from '@/config/map';
import LeafletTouchFix from './components/LeafletTouchFix';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { ExtendedAircraft } from '@/types/base';
import MapControllerWithOptions from './MapControllerWithOptions';
import SimplifiedAircraftMarker from './SimplifiedAircraftMarker';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import DraggablePanel from '../DraggablePanel';
import EnhancedTooltip from './components/AircraftTooltip';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import 'leaflet/dist/leaflet.css';
import OwnershipTypeFilter from '../map/components/OwnershipTypeFilter';
// Import the tooltip provider
import { AircraftTooltipProvider } from '../context/AircraftTooltipContext';
import type { SelectOption } from '@/types/base';
import GeofenceCircle from './GeofenceCircle';
import GeofenceControl from './GeofenceControl';
import { adaptGeofenceAircraft } from '../../../lib/utils/geofenceAdapter';
import { enrichGeofenceAircraft } from '../../../lib/utils/geofenceEnricher';
import { getAircraftNearLocation } from '../../../lib/services/geofencing';
import RibbonAircraftSelector from '../selector/Ribon';

// Map Events component to handle zoom changes
const MapEvents: React.FC = () => {
  const { setZoomLevel } = useEnhancedMapContext();
  const { setIsLoading } = useEnhancedUI();

  const map = useMapEvents({
    zoomend: () => {
      const zoom = map.getZoom();
      console.log('Map zoomed to level:', zoom);
      setZoomLevel(zoom);
    },
    movestart: () => {
      setIsLoading(true);
    },
    moveend: () => {
      setIsLoading(false);
    },
  });

  return null;
};

// Inner component to connect the map instance to context
const MapControllerInner: React.FC = () => {
  const { setMapInstance } = useEnhancedMapContext();
  const map = useMap();

  useEffect(() => {
    console.log('[EnhancedReactBaseMap] Registering map with context');
    setMapInstance(map);

    // Apply Leaflet fixes to prevent flickering
    const fixLeafletInteractions = () => {
      // Ensure all marker interactions are properly disabled
      document.querySelectorAll('.leaflet-marker-icon').forEach((marker) => {
        marker.classList.remove('leaflet-interactive');
        if (marker instanceof HTMLElement) {
          marker.style.pointerEvents = 'none';
        }
      });
    };

    // Apply fixes immediately and after map interactions
    fixLeafletInteractions();
    map.on('moveend', fixLeafletInteractions);
    map.on('zoomend', fixLeafletInteractions);

    return () => {
      console.log('[EnhancedReactBaseMap] Cleaning up map registration');
      setMapInstance(null);
      map.off('moveend', fixLeafletInteractions);
      map.off('zoomend', fixLeafletInteractions);
    };
  }, [map, setMapInstance]);

  return null;
};

// Props interface
export interface ReactBaseMapProps {
  onError: (message: string) => void;
}

const EnhancedReactBaseMap: React.FC<ReactBaseMapProps> = ({ onError }) => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const {
    displayedAircraft,
    isRefreshing,
    setZoomLevel,
    zoomLevel,
    // Add these geofencing properties from context
    geofenceCenter,
    geofenceRadius,
    isGeofenceActive,
  } = useEnhancedMapContext();

  // Get UI context functions including openPanel
  const { selectAircraft, openPanel, closePanel, panels, isLoading } =
    useEnhancedUI();

  // Initialize with all owner types selected
  const [ownerFilters, setOwnerFilters] = useState<string[]>([
    'individual',
    'partnership',
    'corp-owner',
    'co-owned',
    'llc',
    'non-citizen-corp',
    'airline',
    'freight',
    'medical',
    'media',
    'historical',
    'flying-club',
    'emergency',
    'local-govt',
    'education',
    'federal-govt',
    'flight-school',
    'leasing-corp',
    'military',
    'unknown',
  ]);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        const response = await fetch('/api/tracking/manufacturers');
        const data = await response.json();
        setManufacturers(data);
      } catch (error) {
        onError('Failed to load manufacturers');
      }
    };

    fetchManufacturers();
  }, [onError]);

  // Define these helper functions before they're used in useMemo
  const getAircraftOwnerType = (aircraft: ExtendedAircraft): string => {
    const ownerType = aircraft.TYPE_REGISTRANT || 0;
    return ownerTypeToString(ownerType);
  };

  // Helper function to convert numeric owner types to strings
  const ownerTypeToString = (type: number | string): string => {
    const typeNum = typeof type === 'string' ? parseInt(type, 10) : type;

    const ownerTypeMap: Record<number, string> = {
      1: 'individual',
      2: 'partnership',
      3: 'corp-owner',
      4: 'co-owned',
      7: 'llc',
      8: 'non-citizen-corp',
      9: 'airline',
      10: 'freight',
      11: 'medical',
      12: 'media',
      13: 'historical',
      14: 'flying-club',
      15: 'emergency',
      16: 'local-govt',
      17: 'education',
      18: 'federal-govt',
      19: 'flight-school',
      20: 'leasing-corp',
      21: 'military',
    };

    return ownerTypeMap[typeNum] || 'unknown';
  };

  // Create filtered aircraft using geofence
  const filteredAircraft = useMemo(() => {
    // First filter for valid coordinates
    const aircraftWithValidCoords = displayedAircraft.filter(
      (plane) =>
        typeof plane.latitude === 'number' &&
        typeof plane.longitude === 'number' &&
        !isNaN(plane.latitude) &&
        !isNaN(plane.longitude)
    );

    // Apply owner filters if they exist
    let filteredByOwner =
      ownerFilters.length === 0
        ? aircraftWithValidCoords
        : aircraftWithValidCoords.filter((aircraft) =>
            ownerFilters.includes(getAircraftOwnerType(aircraft))
          );

    return filteredByOwner;
  }, [
    displayedAircraft,
    ownerFilters,
    isGeofenceActive,
    geofenceCenter,
    geofenceRadius,
  ]);
  //###################################################################################################
  const GeofenceCircle: React.FC = () => {
    const { geofenceCenter, geofenceRadius, isGeofenceActive } =
      useEnhancedMapContext();

    if (!geofenceCenter || !isGeofenceActive) {
      return null;
    }

    // Use non-null assertion operator to tell TypeScript we've checked for null
    const center: [number, number] = [geofenceCenter!.lat, geofenceCenter!.lng];
    const radius = (geofenceRadius || 25) * 1000; // Default to 25km if null

    return (
      <Circle
        center={center}
        radius={radius}
        pathOptions={{
          color: 'blue',
          fillColor: 'blue',
          fillOpacity: 0.2,
          weight: 2,
        }}
      />
    );
  };

  // Helper function to calculate distance (in km) between two points
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  const handleOpenSettings = () => {
    // Now openPanel is properly accessed from the context
    openPanel('settings', null, { x: 20, y: 20 }, 'Map Settings');
  };

  const handleOwnerFilterChange = (types: string[]) => {
    console.log('Owner filters changed:', types);
    setOwnerFilters(types);
    // No need for additional filtering logic here as it's handled in the useMemo above
  };

  // Handle aircraft selection
  const handleMarkerClick = (aircraft: ExtendedAircraft) => {
    selectAircraft(aircraft);
  };

  const MapClickHandler = () => {
    const {
      setGeofenceCenter,
      isGeofenceActive,
      geofenceRadius,
      updateGeofenceAircraft, // Make sure this is available in your context
    } = useEnhancedMapContext();

    // This function will get and process aircraft data
    const fetchAircraftForClickLocation = async (lat: number, lng: number) => {
      try {
        console.log('Fetching aircraft near clicked location:', lat, lng);

        // Call the same function that "Use My Location" uses
        const fetchedAircraft = await getAircraftNearLocation(
          lat,
          lng,
          geofenceRadius || 25
        );

        // Process the aircraft data just like in your other functions
        if (fetchedAircraft.length === 0) {
          console.log('No aircraft found near clicked location');
          return;
        }

        // Convert to your application's format if needed
        const adaptedAircraft = adaptGeofenceAircraft(fetchedAircraft);
        const enrichedAircraft = await enrichGeofenceAircraft(adaptedAircraft);

        // Update the context with the new aircraft
        updateGeofenceAircraft(enrichedAircraft);

        console.log(
          `Found ${enrichedAircraft.length} aircraft near clicked location`
        );
      } catch (error) {
        console.error('Error fetching aircraft for clicked location:', error);
      }
    };

    const map = useMapEvents({
      click: (e) => {
        if (isGeofenceActive) {
          const { lat, lng } = e.latlng;
          console.log('Map clicked at:', lat, lng);

          // Set the geofence center (visual part)
          setGeofenceCenter({ lat, lng });

          // Fetch aircraft data for this location (data part)
          fetchAircraftForClickLocation(lat, lng);
        }
      },
    });

    return null;
  };

  // The main component return statement should look like this:
  return (
    <div className="relative w-full h-full">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-2 right-2 z-50 bg-white rounded-md py-1 px-3 shadow-md">
          <LoadingSpinner size="sm" message="Loading..." />
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapControllerWithOptions />
        <MapControllerInner />
        <MapEvents />
        <ZoomControl position="bottomright" />
        <LeafletTouchFix />
        <LayersControl position="topright" />

        {/* Wrap aircraft markers with the tooltip provider */}
        <AircraftTooltipProvider>
          {filteredAircraft.map((aircraft: ExtendedAircraft) => (
            <SimplifiedAircraftMarker
              key={aircraft.ICAO24}
              aircraft={aircraft}
              onClick={() => handleMarkerClick(aircraft)}
            />
          ))}
        </AircraftTooltipProvider>

        {/* Geofence components */}
        <MapClickHandler />
        <GeofenceCircle />
      </MapContainer>

      {/* Geofence info display */}
      {isGeofenceActive && geofenceCenter && (
        <div className="absolute bottom-5 right-5 z-50 bg-white p-2 rounded-md shadow-md">
          <span className="font-medium">
            {filteredAircraft.length} aircraft within {geofenceRadius}km radius
          </span>
        </div>
      )}

      {/* Settings panel */}
      {panels.settings.isOpen && (
        <DraggablePanel
          isOpen={panels.settings.isOpen}
          onClose={() => closePanel('settings')}
          title="Map Settings"
          initialPosition={panels.settings.position}
          className="bg-white rounded-lg shadow-lg"
        >
          <div className="p-4">
            <h3 className="font-medium mb-2">Display Options</h3>
            {/* Settings content would go here */}
          </div>
        </DraggablePanel>
      )}

      {/* Manufacturer filter */}
      {manufacturers.length > 0 && (
        <div className="absolute top-5 left-5 z-50">
          <RibbonAircraftSelector manufacturers={manufacturers} />
        </div>
      )}
    </div>
  );
};

export default EnhancedReactBaseMap;
