import type { LatLngBoundsExpression } from 'leaflet';
import { RegionCode } from '../types/base';

export const MAP_CONFIG = {
  // Set center to a more global view (close to 0,0 but adjusted for better visibility)
  CENTER: [20, 0] as [number, number],
  DEFAULT_ZOOM: 3,

  // Keep North America bounds but add definitions for other regions
  NORTH_AMERICA_BOUNDS: [
  [5.0, -170.0],  // Southwest (includes Hawaii and southern Central America)
  [75.0, -50.0]   // Northeast (includes most of Canada, includes far northern territories)
] as LatLngBoundsExpression,

  REGION_ZOOM_LEVELS: {
  GLOBAL: 2,             // Decreased from 3 to 2 for better global view
  North_America: 3,      // Decreased from 4 to 3 to show the full continent
  South_America: 3,      // Decreased from 4 to 3
  Europe: 4,             // Keep as is
  Asia: 3,               // Decreased from 4 to 3 due to Asia's large size
  Africa: 3,             // Decreased from 4 to 3
  Oceania: 3,            // Decreased from 4 to 3
},


  // Add other regional bounds
  SOUTH_AMERICA_BOUNDS: [
    [-60.0, -85.0],
    [15.0, -30.0],
  ] as LatLngBoundsExpression,

  EUROPE_BOUNDS: [
    [36.0, -10.0],
    [70.0, 40.0],
  ] as LatLngBoundsExpression,

  ASIA_BOUNDS: [
  [-10.0, 40.0],  // Southwest (expanded westward to include more of Middle East)
  [65.0, 150.0]   // Northeast (slightly expanded northward)
] as LatLngBoundsExpression,

  AFRICA_BOUNDS: [
    [-35.0, -20.0],
    [40.0, 55.0],
  ] as LatLngBoundsExpression,

  OCEANIA_BOUNDS: [
    [-50.0, 110.0],
    [10.0, 180.0],
  ] as LatLngBoundsExpression,

  GLOBAL_BOUNDS: [
    [-85, -180],
    [85, 180],
  ] as LatLngBoundsExpression,

  OPTIONS: {
    zoomControl: false,
    minZoom: 3, // Allow a bit more zoom out for global view
    maxZoom: 18,
    scrollWheelZoom: true as const,
    worldCopyJump: true,
  },

  CONTROLS: {
    ZOOM: {
      MIN: 2, // Match minZoom from OPTIONS
      MAX: 18,
      DEFAULT: 3, // Slightly zoomed out for global view
      AIRCRAFT_FOCUS: 12,
      POSITION: 'topright',
    },
    BOUNDS: {
      MAX_LAT: 85,
      MIN_LAT: -85,
      MAX_LNG: 180,
      MIN_LNG: -180,
    },
    POSITION: {
      TOP_RIGHT: 'topright',
      TOP_LEFT: 'topleft',
      BOTTOM_RIGHT: 'bottomright',
      BOTTOM_LEFT: 'bottomleft',
    },
    TILE_LAYER: {
      // OpenStreetMap is generally better for global coverage than OpenTopoMap
      URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ATTRIBUTION:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    // Add alternate tile layers that might be better for global use
    ALTERNATE_LAYERS: {
      TERRAIN: {
        URL: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png',
        ATTRIBUTION:
          'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
        maxZoom: 18,
      },
      TONER: {
        URL: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png',
        ATTRIBUTION:
          'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
        maxZoom: 18,
      },
    },
  },

  REFRESH_INTERVALS: {
    POSITION_UPDATE: 50000,
    DATA_SYNC: 60000,
  },

  PADDING: {
    DEFAULT: [20, 20] as [number, number],
    SIDEBAR_OPEN: [300, 20] as [number, number],
  },

  CRS: null, // <- Temporarily null until you request it on client side

  CLUSTER: {
    MAX_CLUSTER_RADIUS: 80,
    SPIDERFY_ON_MAX_ZOOM: true,
    SHOW_COVERAGE_ON_HOVER: false,
    DISABLE_CLUSTERS_AT_ZOOM: 12,
  },

  BASE_LAYERS: {
    OSM: 'OpenStreetMap',
    SATELLITE: 'Satellite',
    TOPOGRAPHIC: 'Topographic',
    TERRAIN: 'Terrain',
    TONER: 'Toner',
  },

  // Define regions for quick selection
  REGIONS: {
    GLOBAL: RegionCode.GLOBAL,
    North_America: RegionCode.North_America,
    Europe: RegionCode.Europe,
    Asia: RegionCode.Asia,
    Africa: RegionCode.Africa,
    Oceania: RegionCode.Oceania,
    South_America: RegionCode.South_America,
  },
};

// Reusable Bounds and Tile Layer
export const CONTINENTAL_US_BOUNDS: LatLngBoundsExpression =
  MAP_CONFIG.NORTH_AMERICA_BOUNDS;
export const GLOBAL_BOUNDS: LatLngBoundsExpression = MAP_CONFIG.GLOBAL_BOUNDS;
export const TILE_LAYER = MAP_CONFIG.CONTROLS.TILE_LAYER;

// ✨ Client-side utility to get CRS when needed
export const getLeafletCRS = () => {
  if (typeof window !== 'undefined') {
    const L = require('leaflet');
    return L.CRS.EPSG3857;
  }
  return null;
};

// Helper function to get bounds by region name
export const getBoundsByRegion = (
  region: RegionCode | string
): LatLngBoundsExpression => {
  let bounds: LatLngBoundsExpression;
  
  // Handle numeric regions (convert to number if it's a string number)
  const regionCode = typeof region === 'string' && !isNaN(Number(region)) 
    ? Number(region) 
    : region;
    
  console.log(`Getting bounds for region: ${regionCode} (${typeof regionCode})`);
  
  switch (Number(regionCode)) {
    case RegionCode.North_America:
      bounds = MAP_CONFIG.NORTH_AMERICA_BOUNDS;
      break;
    case RegionCode.Europe:
      bounds = MAP_CONFIG.EUROPE_BOUNDS;
      break;
    case RegionCode.Asia:
      bounds = MAP_CONFIG.ASIA_BOUNDS;
      break;
    case RegionCode.Africa:
      bounds = MAP_CONFIG.AFRICA_BOUNDS;
      break;
    case RegionCode.Oceania:
      bounds = MAP_CONFIG.OCEANIA_BOUNDS;
      break;
    case RegionCode.South_America:
      bounds = MAP_CONFIG.SOUTH_AMERICA_BOUNDS;
      break;
    case RegionCode.GLOBAL:
    default:
      bounds = MAP_CONFIG.GLOBAL_BOUNDS;
      break;
  }
  
  console.log('Resolved bounds:', bounds);
  return bounds;
};

// Helper function to debug bounds and center calculation
export const debugBoundsAndCenter = (region: RegionCode | string) => {
  const bounds = getBoundsByRegion(region);
  
  if (Array.isArray(bounds) && bounds.length === 2) {
    const southWest = bounds[0];
    const northEast = bounds[1];
    
    if (Array.isArray(southWest) && Array.isArray(northEast) && 
        southWest.length === 2 && northEast.length === 2) {
      
      const centerLat = (southWest[0] + northEast[0]) / 2;
      const centerLng = (southWest[1] + northEast[1]) / 2;
      
      console.log({
        region,
        bounds,
        center: [centerLat, centerLng]
      });
      
      return {
        region,
        bounds,
        center: [centerLat, centerLng]
      };
    }
  }
  
  console.error('Invalid bounds format:', bounds);
  return null;
};

// Add a new helper function to get the appropriate zoom level for a region
export const getZoomLevelForRegion = (region: RegionCode | string): number => {
  // Handle string-based regions for backward compatibility
  if (typeof region === 'string') {
    switch (region) {
      case 'North America':
        return MAP_CONFIG.REGION_ZOOM_LEVELS.North_America;
      case 'Europe':
        return MAP_CONFIG.REGION_ZOOM_LEVELS.Europe;
      case 'Asia':
        return MAP_CONFIG.REGION_ZOOM_LEVELS.Asia;
      case 'Africa':
        return MAP_CONFIG.REGION_ZOOM_LEVELS.Africa;
      case 'Oceania':
        return MAP_CONFIG.REGION_ZOOM_LEVELS.Oceania;
      case 'Global':
      default:
        return MAP_CONFIG.REGION_ZOOM_LEVELS.GLOBAL;
    }
  }

  // Handle numeric regions
  switch (region) {
    case RegionCode.North_America:
      return MAP_CONFIG.REGION_ZOOM_LEVELS.North_America;
    case RegionCode.Europe:
      return MAP_CONFIG.REGION_ZOOM_LEVELS.Europe;
    case RegionCode.Asia:
      return MAP_CONFIG.REGION_ZOOM_LEVELS.Asia;
    case RegionCode.Africa:
      return MAP_CONFIG.REGION_ZOOM_LEVELS.Africa;
    case RegionCode.Oceania:
      return MAP_CONFIG.REGION_ZOOM_LEVELS.Oceania;
    case RegionCode.South_America:
      // Fallback if South America zoom level isn't defined
      return (
        MAP_CONFIG.REGION_ZOOM_LEVELS.South_America ||
        MAP_CONFIG.REGION_ZOOM_LEVELS.GLOBAL
      );
    case RegionCode.GLOBAL:
    default:
      return MAP_CONFIG.REGION_ZOOM_LEVELS.GLOBAL;
  }
};
