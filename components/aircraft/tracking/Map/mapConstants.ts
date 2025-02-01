// mapConstants.ts
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet';

export const MAP_CONFIG = {
  CENTER: [39.8283, -98.5795] as [number, number], // Geographic center of continental US
  DEFAULT_ZOOM: 4,
  MIN_ZOOM: 3,
  MAX_ZOOM: 18,
  US_BOUNDS: [
    [24.396308, -125.0], // Southwest coordinates
    [49.384358, -66.93457], // Northeast coordinates
  ] as [[number, number], [number, number]],
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

export const MAP_OPTIONS = {
  minZoom: 3,
  maxZoom: 18,
  scrollWheelZoom: true,
  zoomControl: false,
};

export const CONTINENTAL_US_BOUNDS: LatLngBoundsExpression = [
  [24.396308, -125.0], // Southwest corner
  [49.384358, -66.93457], // Northeast corner
];

export const TILE_LAYER = MAP_CONFIG.CONTROLS.TILE_LAYER;