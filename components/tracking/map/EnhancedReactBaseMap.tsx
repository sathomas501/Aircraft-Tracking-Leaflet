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
import { MapPin, Crosshair, X } from 'lucide-react';
import { MAP_CONFIG } from '@/config/map';
import LeafletTouchFix from './components/LeafletTouchFix';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { ExtendedAircraft } from '@/types/base';
import MapControllerWithOptions from './MapControllerWithOptions';
import SimplifiedAircraftMarker from './SimplifiedAircraftMarker';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import 'leaflet/dist/leaflet.css';
import { AircraftTooltipProvider } from '../context/AircraftTooltipContext';
import type { SelectOption } from '@/types/base';
import { adaptGeofenceAircraft } from '../../../lib/utils/geofenceAdapter';
import { enrichGeofenceAircraft } from '../../../lib/utils/geofenceEnricher';
import { getAircraftNearLocation } from '../../../lib/services/geofencing';
import AircraftSpinner from './components/AircraftSpinner';
import PopupFixer from './components/PopupFixer';

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

  const PlacementModeControls = () => {
    const { isGeofencePlacementMode, setIsGeofencePlacementMode } =
      useEnhancedMapContext();

    if (!isGeofencePlacementMode) return null;

    return (
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center">
        <div className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-2 mb-2">
          <Crosshair size={16} />
          <span>Click anywhere on map to set geofence location</span>
        </div>

        <button
          onClick={() => setIsGeofencePlacementMode(true)}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md shadow-md hover:bg-gray-50 flex items-center gap-2"
        >
          <X size={16} />
          Exit Placement Mode
        </button>
      </div>
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
      updateGeofenceAircraft,
      isGeofencePlacementMode,
      setIsGeofencePlacementMode,
    } = useEnhancedMapContext();

    // State for the temporary indicator
    const [showIndicator, setShowIndicator] = useState(false);

    // Effect to manage cursor styling based on mode
    useEffect(() => {
      // Find the map container element
      const mapElement = document.querySelector('.leaflet-container');
      if (mapElement) {
        // Apply cursor style based on mode
        if (isGeofencePlacementMode) {
          mapElement.classList.add('geofence-placement-mode');

          // Show the indicator when placement mode is activated
          setShowIndicator(true);

          // Hide indicator after 5 seconds
          const timer = setTimeout(() => {
            setShowIndicator(false);
          }, 5000);

          return () => clearTimeout(timer);
        } else {
          mapElement.classList.remove('geofence-placement-mode');
          setShowIndicator(false);
        }
      }
    }, [isGeofencePlacementMode]);

    // Function to get and process aircraft data
    const fetchAircraftForClickLocation = async (lat: number, lng: number) => {
      try {
        console.log('Fetching aircraft near clicked location:', lat, lng);

        // Call the same function that "Use My Location" uses
        const fetchedAircraft = await getAircraftNearLocation(
          lat,
          lng,
          geofenceRadius || 25
        );

        // Process the aircraft data
        if (fetchedAircraft.length === 0) {
          console.log('No aircraft found near clicked location');
          return;
        }

        // Convert to your application's format
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

    // Map event handler
    const map = useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;

        // Only process as geofence click if in placement mode
        if (isGeofencePlacementMode) {
          console.log('Map clicked for geofence at:', lat, lng);

          // Set the geofence center
          setGeofenceCenter({ lat, lng });

          // Dispatch custom event for useFilterLogic
          const event = new CustomEvent('map-geofence-click', {
            detail: { lat, lng },
          });
          document.dispatchEvent(event);

          // Exit placement mode after setting location
          setIsGeofencePlacementMode(false);

          // If geofence is already active, also fetch the aircraft data
          if (isGeofenceActive) {
            fetchAircraftForClickLocation(lat, lng);
          }
        } else {
          // Normal map click behavior
          console.log('Normal map click at:', lat, lng);
        }
      },
    });

    return (
      <>
        {showIndicator && (
          <div className="geofence-mode-indicator">
            Click anywhere on map to set geofence location
          </div>
        )}
      </>
    );
  };

  // The main component return statement should look like this:
  return (
    <div className="relative w-full h-full">
      {/* Full-page aircraft spinner - using CSS modules now */}
      <AircraftSpinner isLoading={isLoading} />

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
          {filteredAircraft.map((aircraft) => (
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
        <PopupFixer />
      </MapContainer>
      {/* Place this after MapContainer so it appears on top */}
      <PlacementModeControls />
      {/* Other components remain the same */}
      {/* ... */}
    </div>
  );
};

export default EnhancedReactBaseMap;
