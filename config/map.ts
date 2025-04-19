import type { LatLngBoundsExpression } from 'leaflet';
import { RegionCode } from '../types/base';

export const MAP_CONFIG = {
  // Set center to a more global view (close to 0,0 but adjusted for better visibility)
  CENTER: [20, 0] as [number, number],
  DEFAULT_ZOOM: 3,

  // Keep North America bounds but add definitions for other regions
  NORTH_AMERICA_BOUNDS: [
    [7.0, -180.0], // Southwest (includes Hawaii and southern Central America)
    [72.0, -50.0], // Northeast (includes most of Canada, excludes far northern territories)
  ] as LatLngBoundsExpression,

  REGION_ZOOM_LEVELS: {
    GLOBAL: 3,
    North_America: 4,
    South_America: 4,
    Europe: 4,
    Asia: 4,
    Africa: 4,
    Oceania: 4,
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
    [-10.0, 60.0],
    [60.0, 150.0],
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
  // Check if the region is a string (backward compatibility)
  if (typeof region === 'string') {
    // Handle legacy string-based regions for backward compatibility
    switch (region) {
      case 'North America':
        return MAP_CONFIG.NORTH_AMERICA_BOUNDS;
      case 'Europe':
        return MAP_CONFIG.EUROPE_BOUNDS;
      case 'Asia':
        return MAP_CONFIG.ASIA_BOUNDS;
      case 'Africa':
        return MAP_CONFIG.AFRICA_BOUNDS;
      case 'Oceania':
        return MAP_CONFIG.OCEANIA_BOUNDS;
      case 'South America':
        return MAP_CONFIG.SOUTH_AMERICA_BOUNDS;
      case 'Global':
      default:
        return MAP_CONFIG.GLOBAL_BOUNDS;
    }
  }

  // Handle numeric regions
  switch (region) {
    case RegionCode.North_America:
      return MAP_CONFIG.NORTH_AMERICA_BOUNDS;
    case RegionCode.Europe:
      return MAP_CONFIG.EUROPE_BOUNDS;
    case RegionCode.Asia:
      return MAP_CONFIG.ASIA_BOUNDS;
    case RegionCode.Africa:
      return MAP_CONFIG.AFRICA_BOUNDS;
    case RegionCode.Oceania:
      return MAP_CONFIG.OCEANIA_BOUNDS;
    case RegionCode.South_America:
      return MAP_CONFIG.SOUTH_AMERICA_BOUNDS;
    case RegionCode.GLOBAL:
    default:
      return MAP_CONFIG.GLOBAL_BOUNDS;
  }
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
