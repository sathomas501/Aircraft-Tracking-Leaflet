//utils/mapConstants.ts

import type { LatLngExpression } from 'leaflet';

export const MAP_OPTIONS = {  // Add this
  minZoom: 3,
  maxZoom: 18,
  scrollWheelZoom: true,
  zoomControl: false
};

export const MAP = {
  DEFAULT_CENTER: [39.8283, -98.5795] as LatLngExpression,
  DEFAULT_ZOOM: 4,
  OPTIONS: {
    zoomControl: false,
    minZoom: 3,
    maxZoom: 18,
    scrollWheelZoom: true as const,
    worldCopyJump: true
  },
  CONTROLS: {
    ZOOM: {
      MIN: 3,
      MAX: 18,
      DEFAULT: 4,
      AIRCRAFT_FOCUS: 12
    },
    BOUNDS: {
      MAX_LAT: 85,
      MIN_LAT: -85,
      MAX_LNG: 180,
      MIN_LNG: -180
    },
    POSITION: {
      TOP_RIGHT: 'topright',
      TOP_LEFT: 'topleft',
      BOTTOM_RIGHT: 'bottomright',
      BOTTOM_LEFT: 'bottomleft'
    }
  },
  TILE_LAYER: {
    URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
} as const;
