//config/map.ts
import type { LatLngBoundsExpression } from 'leaflet';
import L from 'leaflet';

export const MAP_CONFIG = {
  CENTER: [39.8283, -98.5795] as [number, number],
  DEFAULT_ZOOM: 4,
  US_BOUNDS: [
    [24.396308, -125.0],
    [49.384358, -66.93457],
  ] as LatLngBoundsExpression,
  OPTIONS: {
    zoomControl: false,
    minZoom: 3,
    maxZoom: 18,
    scrollWheelZoom: true as const,
    worldCopyJump: true,
  },
  CONTROLS: {
    ZOOM: {
      MIN: 3,
      MAX: 18,
      DEFAULT: 4,
      AIRCRAFT_FOCUS: 12,
      POSITION: 'topright', // Move Zoom Control to the Top-Right
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
      URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ATTRIBUTION:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
  CRS: L.CRS.EPSG3857,
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
  },
} as const;

// Reusable Bounds and Tile Layer
export const CONTINENTAL_US_BOUNDS: LatLngBoundsExpression =
  MAP_CONFIG.US_BOUNDS;
export const TILE_LAYER = MAP_CONFIG.CONTROLS.TILE_LAYER;
