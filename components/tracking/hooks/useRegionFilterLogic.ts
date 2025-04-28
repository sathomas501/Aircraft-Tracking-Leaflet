// hooks/useRegionFilterLogic.ts
import { useState, useEffect } from 'react';
import { RegionCode } from '@/types/base';
import { MAP_CONFIG, getBoundsByRegion, getZoomLevelForRegion } from '@/config/map';
import { ExtendedAircraft } from '@/types/base';
import { useFilterUILogic } from './useFilterUILogic';

interface RegionOutline {
    remove: () => void;
}

interface FilteredAircraftResponse {
    aircraft: AircraftData[];
}

interface AircraftData {
    TYPE_AIRCRAFT?: string;
    OPERATOR?: string;
    REGION: number;
}

interface UseRegionFilterLogicReturn {
    activeRegion: RegionCode | string | null;
    regionOutline: RegionOutline | null;
    selectedRegion: number;
    setActiveRegion: React.Dispatch<React.SetStateAction<RegionCode | string | null>>;
    setRegionOutline: React.Dispatch<React.SetStateAction<RegionOutline | null>>;
    setSelectedRegion: React.Dispatch<React.SetStateAction<number>>;
    handleRegionSelect: (region: RegionCode) => Promise<void>;
    filterAircraftByRegion: (region: string) => void;
    drawRegionOutline: (region: RegionCode) => void;
}

export function useRegionFilterLogic(
    mapInstance: any,
    updateGeofenceAircraft: (aircraft: ExtendedAircraft[]) => void,
    clearGeofenceData: () => void,
    displayedAircraft: ExtendedAircraft[]
): UseRegionFilterLogicReturn {
    const [activeRegion, setActiveRegion] = useState<RegionCode | string | null>(null);
    const [regionOutline, setRegionOutline] = useState<RegionOutline | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<number>(RegionCode.GLOBAL);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [localLoading, setLocalLoading] = useState(false);
    

    const filterAircraftByRegion = (region: string): void => {
        if (!displayedAircraft || displayedAircraft.length === 0) return;
        setLocalLoading(true);

        try {
            const boundsExpression = getBoundsByRegion(region);

            if (!Array.isArray(boundsExpression) || boundsExpression.length !== 2) {
                console.error(`Invalid bounds format for region: ${region}`, boundsExpression);
                setLocalLoading(false);
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
        }
    };

    const handleRegionSelect = async (region: RegionCode): Promise<void> => {
        setActiveRegion(region);
        setSelectedRegion(region);
        setLocalLoading(true);

        try {
            if (mapInstance) {
                const bounds = getBoundsByRegion(region);
                const zoomLevel = getZoomLevelForRegion(region);

                mapInstance.setZoom(zoomLevel);

                const options = {
                    padding: MAP_CONFIG.PADDING.DEFAULT,
                };

                mapInstance.fitBounds(bounds as any, options);
                mapInstance.invalidateSize();
                drawRegionOutline(region);
            }

            const countResponse = await fetch(`/api/tracking/region-count?region=${region}`);
            if (countResponse.ok) {
                const countData = await countResponse.json();
                console.log(`${countData.count} aircraft available in this region`);
            }

            if (clearGeofenceData) {
                clearGeofenceData();
            }
        } catch (error) {
            console.error('Error in region selection:', error);
        } finally {
            setLocalLoading(false);
            setActiveDropdown(null);
        }
    };

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

    const fetchAircraftByRegionAndManufacturer = async (
    region: RegionCode,
    manufacturer: string,
    page: number = 1,
    limit: number = 500
  ) => {
    if (!region || !manufacturer) {
      console.log('Both region and manufacturer must be selected');
      return;
    }

    setLocalLoading(true);

    try {
      const response = await fetch(
        `/api/tracking/filtered-aircraft?region=${region}&manufacturer=${encodeURIComponent(manufacturer)}&page=${page}&limit=${limit}`
      );

      const data = await response.json();
      const aircraftData = data.aircraft || [];

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Process the filtered aircraft data
      if (aircraftData.length > 0) {
        // Transform to ExtendedAircraft
        interface AircraftData {
          TYPE_AIRCRAFT?: string;
          OPERATOR?: string;
          REGION: number;
        }

        const extendedAircraft: ExtendedAircraft[] = aircraftData.map(
          (aircraft: AircraftData) => ({
            ...aircraft,
            type: aircraft.TYPE_AIRCRAFT || 'Unknown',
            isGovernment:
              aircraft.OPERATOR?.toLowerCase().includes('government') ?? false,
            REGION: aircraft.REGION,
            zoomLevel: undefined,
          })
        );

        // Update the map
        updateGeofenceAircraft(extendedAircraft);
      } else {
        console.log(
          `No aircraft found for manufacturer ${manufacturer} in region ${region}`
        );
      }
    } catch (error) {
      console.error('Error fetching filtered aircraft:', error);
    } finally {
      setLocalLoading(false);
    }
  };

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
        setActiveRegion,
        setRegionOutline,
        setSelectedRegion,
        handleRegionSelect,
        filterAircraftByRegion,
        drawRegionOutline,
    };
}
