import type { LatLngBoundsExpression } from 'leaflet';

export const MAP_CONFIG = {
  // Set center to a more global view (close to 0,0 but adjusted for better visibility)
  CENTER: [20, 0] as [number, number],
  DEFAULT_ZOOM: 3,

  // Keep North America bounds but add definitions for other regions
  NORTH_AMERICA_BOUNDS: [
    [8.0, -170.0], // Southwest (includes Central America)
    [83.0, -50.0], // Northeast (includes Canada's northern territories)
  ] as LatLngBoundsExpression,

  // Add other regional bounds
  EUROPE_BOUNDS: [
    [34.0, -10.0],
    [72.0, 45.0],
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
    minZoom: 2, // Allow a bit more zoom out for global view
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
    POSITION_UPDATE: 5000,
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
    GLOBAL: 'Global',
    NORTH_AMERICA: 'North America',
    EUROPE: 'Europe',
    ASIA: 'Asia',
    AFRICA: 'Africa',
    OCEANIA: 'Oceania',
  },
} as const;

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
export const getBoundsByRegion = (region: string): LatLngBoundsExpression => {
  switch (region) {
    case MAP_CONFIG.REGIONS.NORTH_AMERICA:
      return MAP_CONFIG.NORTH_AMERICA_BOUNDS;
    case MAP_CONFIG.REGIONS.EUROPE:
      return MAP_CONFIG.EUROPE_BOUNDS;
    case MAP_CONFIG.REGIONS.ASIA:
      return MAP_CONFIG.ASIA_BOUNDS;
    case MAP_CONFIG.REGIONS.AFRICA:
      return MAP_CONFIG.AFRICA_BOUNDS;
    case MAP_CONFIG.REGIONS.OCEANIA:
      return MAP_CONFIG.OCEANIA_BOUNDS;
    case MAP_CONFIG.REGIONS.GLOBAL:
    default:
      return MAP_CONFIG.GLOBAL_BOUNDS;
  }
};
