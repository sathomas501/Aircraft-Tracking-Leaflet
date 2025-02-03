import type { LatLngBoundsExpression } from 'leaflet';
import L from 'leaflet';

// General Map Options
export const MAP_OPTIONS = {
  minZoom: 3,
  maxZoom: 18,
  scrollWheelZoom: true,
  zoomControl: false,
};

// Map Configuration
export const MAP_CONFIG = {
  CENTER: [39.8283, -98.5795] as [number, number], // Geographic center of continental US
  DEFAULT_ZOOM: 4,
  US_BOUNDS: [
    [24.396308, -125.0], // Southwest corner (approx.)
    [49.384358, -66.93457], // Northeast corner (approx.)
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
} as const;

// Reusable Bounds and Tile Layer
export const CONTINENTAL_US_BOUNDS: LatLngBoundsExpression = MAP_CONFIG.US_BOUNDS;
export const TILE_LAYER = MAP_CONFIG.CONTROLS.TILE_LAYER;

// Tile Layer Settings
export const TILE_LAYER_CONFIG = {
  MAX_NATIVE_ZOOM: 18,
  DETECT_RETINA: true,
  TILE_SIZE: 256,
  UPDATE_WHEN_IDLE: true,
};

// Default Marker Icons
export const DEFAULT_MARKER_ICON = {
  ICON_URL: '/public/icons/marker-icon.png',
  SHADOW_URL: '/public/icons/marker-shadow.png',
  ICON_SIZE: [25, 41] as [number, number],
  ICON_ANCHOR: [12, 41] as [number, number],
  POPUP_ANCHOR: [0, -34] as [number, number],
};

// Animation Settings
export const ANIMATION_CONFIG = {
  ZOOM_ANIMATION: true,
  FADE_ANIMATION: true,
  MARKER_BOUNCE: false,
};

// Map Padding
export const MAP_PADDING = {
  DEFAULT: [20, 20] as [number, number],
  SIDEBAR_OPEN: [300, 20] as [number, number],
};

// Coordinate Reference System (CRS)
export const MAP_CRS = L.CRS.EPSG3857; // Default Web Mercator projection

// Map Refresh & Polling Intervals
export const MAP_REFRESH_INTERVALS = {
  POSITION_UPDATE: 5000, // 5 seconds for position updates
  DATA_SYNC: 60000,      // 1 minute for data synchronization
};

// Custom Cursor Styles
export const CURSOR_STYLES = {
  DEFAULT: 'grab',
  DRAGGING: 'grabbing',
  POINTER: 'pointer',
};

// Marker Cluster Settings
export const CLUSTER_CONFIG = {
  MAX_CLUSTER_RADIUS: 80,
  SPIDERFY_ON_MAX_ZOOM: true,
  SHOW_COVERAGE_ON_HOVER: false,
  DISABLE_CLUSTERS_AT_ZOOM: 12,
};

// Attribution Controls
export const ATTRIBUTION_CONFIG = {
  POSITION: 'bottomright',
  PREFIX: false,
};

// Map Layer Types
export const BASE_LAYERS = {
  OSM: 'OpenStreetMap',
  SATELLITE: 'Satellite',
  TOPOGRAPHIC: 'Topographic',
};
