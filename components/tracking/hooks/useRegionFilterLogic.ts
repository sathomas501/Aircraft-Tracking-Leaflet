// hooks/useRegionFilterLogic.ts
import { useEffect, useState } from 'react';
import { RegionCode } from '@/types/base';
import { MAP_CONFIG, getBoundsByRegion, getZoomLevelForRegion } from '@/config/map';
import { ExtendedAircraft } from '@/types/base';
import { useCentralFilterState } from '../context/CentralizedFilterContext';

interface RegionOutline {
    remove: () => void;
}

interface AircraftData {
    TYPE_AIRCRAFT?: string;
    OPERATOR?: string;
    REGION: number;
}

interface UseRegionFilterLogicProps {
    mapInstance: any;
    updateGeofenceAircraft: (aircraft: ExtendedAircraft[]) => void;
    clearGeofenceData: () => void;
    activeDropdown: string |null;
    setActiveDropdown:(dropdown: string | null) => void;
    displayedAircraft: ExtendedAircraft[];
}

interface UseRegionFilterLogicReturn {
    activeRegion: RegionCode | string | null;
    regionOutline: RegionOutline | null;
    selectedRegion: number;
    handleRegionSelect: (region: RegionCode) => Promise<void>;
    filterAircraftByRegion: (region: string) => void;
    drawRegionOutline: (region: RegionCode) => void;
}

export function useRegionFilterLogic({
    mapInstance,
    updateGeofenceAircraft,
    clearGeofenceData,
    displayedAircraft
}: UseRegionFilterLogicProps): UseRegionFilterLogicReturn {
    // Use the central state
    const { state, updateFilter, updateUIState, setActiveDropdown } = useCentralFilterState();
    
    // Get region state from central state
    const activeRegion = state.filters.region.value;
    const selectedRegion = state.filters.region.selectedRegion;
    
    // Keep regionOutline as local state
    const [regionOutline, setRegionOutline] = useState<RegionOutline | null>(null);
    
    // Keep loading as local state for now
    const [localLoading, setLocalLoading] = useState(false);

const setLoading = (isLoading: boolean) => {
  updateUIState('loading', isLoading);
};

    const filterAircraftByRegion = (region: string): void => {
        if (!displayedAircraft || displayedAircraft.length === 0) return;
        setLocalLoading(true);

        // Mark UI as loading in central state if available
        updateUIState('loading', true);

        try {
            const boundsExpression = getBoundsByRegion(region);

            if (!Array.isArray(boundsExpression) || boundsExpression.length !== 2) {
                console.error(`Invalid bounds format for region: ${region}`, boundsExpression);
                setLoading(false);
                return;
            }

            const [[minLat, minLng], [maxLat, maxLng]] = boundsExpression;

            const filteredAircraft = displayedAircraft.filter((aircraft) => {
                if (
                    typeof aircraft.latitude !== 'number' ||
                    typeof aircraft.longitude !== 'number' ||
                    isNaN(aircraft.latitude) ||
                    isNaN(aircraft.longitude)
                ) {
                    return false;
                }

                return (
                    aircraft.latitude >= minLat &&
                    aircraft.latitude <= maxLat &&
                    aircraft.longitude >= minLng &&
                    aircraft.longitude <= maxLng
                );
            });

            if (clearGeofenceData) {
                clearGeofenceData();
            }
            updateGeofenceAircraft(filteredAircraft);
        } catch (error) {
            console.error('Error filtering aircraft by region:', error);
        } finally {
            setLocalLoading(false);
            // Update central loading state
            updateUIState('loading', true);
        }
    };


    const handleRegionSelect = async (region: RegionCode): Promise<void> => {
  // Update state first
  updateFilter('region', 'value', region);
  updateFilter('region', 'selectedRegion', region);
  updateFilter('region', 'active', true);
  
  // Clear existing data
  if (clearGeofenceData) {
    clearGeofenceData();
  }
  
  setLocalLoading(true);
  
  try {
    // Add a small delay before map operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (mapInstance) {
      const bounds = getBoundsByRegion(region);
      const zoomLevel = getZoomLevelForRegion(region);
      
      mapInstance.setZoom(zoomLevel);
      
      // Force redraw/reflow before fitBounds
      mapInstance.invalidateSize();
      
      const options = {
        padding: MAP_CONFIG.PADDING.DEFAULT,
      };
      
      mapInstance.fitBounds(bounds as any, options);
      
      // Draw outline after bounds are set
      drawRegionOutline(region);
    }
    
    // Fetch data
    const countResponse = await fetch(`/api/tracking/region-count?region=${region}`);
    if (countResponse.ok) {
      const countData = await countResponse.json();
      console.log(`${countData.count} aircraft available in this region`);
    }
  } catch (error) {
    console.error('Error in region selection:', error);
  } finally {
    setLocalLoading(false);
    updateUIState('loading', false);
    setActiveDropdown(null);
  }
};

// In useRegionFilterLogic.ts
useEffect(() => {
  // If region is selected and map instance exists, center the map
  if (activeRegion && mapInstance) {
    const bounds = getBoundsByRegion(activeRegion as RegionCode);
    const zoomLevel = getZoomLevelForRegion(activeRegion as RegionCode);
    
    mapInstance.setZoom(zoomLevel);
    const options = {
      padding: MAP_CONFIG.PADDING.DEFAULT,
    };
    
    mapInstance.fitBounds(bounds as any, options);
    mapInstance.invalidateSize();
    drawRegionOutline(activeRegion as RegionCode);
  }
}, [activeRegion, mapInstance]); // Depend on activeRegion and mapInstance


    const drawRegionOutline = (region: RegionCode): void => {
        if (!mapInstance) return;

        if (regionOutline) {
            regionOutline.remove();
        }

        const bounds = getBoundsByRegion(region) as [[number, number], [number, number]];

        const L = require('leaflet');
        const rectangle = L.rectangle(bounds, {
            color: '#4f46e5',
            weight: 3,
            opacity: 0.7,
            fill: true,
            fillColor: '#4f46e5',
            fillOpacity: 0.1,
            dashArray: '5, 10',
            interactive: false,
        });

        rectangle.addTo(mapInstance);

        setRegionOutline({
            remove: () => {
                rectangle.remove();
            },
        });
    };

    // Clean up function
    useEffect(() => {
        return () => {
            if (regionOutline) {
                regionOutline.remove();
            }
        };
    }, [regionOutline]);

    return {
        activeRegion,
        regionOutline,
        selectedRegion,
        handleRegionSelect,
        filterAircraftByRegion,
        drawRegionOutline,
    };
}