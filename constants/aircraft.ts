// src/constants/aircraft.ts
export const AIRCRAFT_CONSTANTS = {
  LAYERS: { 
    SELECTED: 1000, 
    AIRBORNE: 100, 
    GROUNDED: 0 
  },
  STATUS: {
    AIRBORNE: { LABEL: '✈️ Airborne', COLOR: 'text-blue-600', EMOJI: '✈️' },
    GROUNDED: { LABEL: '🛬 On Ground', COLOR: 'text-gray-600', EMOJI: '🛬' },
  },
  MARKERS: {
    SIZE: { DEFAULT: 24, SELECTED: 32 },
    COLORS: { DEFAULT: '#4b5563', SELECTED: '#2563eb' },
    OPACITY: { ACTIVE: 1, GROUNDED: 0.7 },
    ANIMATION: { DURATION: 300 }
  },
  DEFAULT_STATE: {
    selectedManufacturer: '',
    selectedModel: '',
    selectedType: '',
    selectedAircraftId: null as string | null,
    nNumber: '',
  },
  CONVERSIONS: { 
    MPS_TO_MPH: 2.237, 
    METERS_TO_FEET: 3.28084 
  },
  LIMITS: {
    UPDATE_INTERVAL: 5000,
    STALE_THRESHOLD: 300000,
    DEFAULT_ALTITUDE: 0,
    MIN_ALTITUDE: -2000,
    MAX_ALTITUDE: 60000,
    MIN_VELOCITY: 0,
    MAX_VELOCITY: 1000,
    COORDINATE_PRECISION: 6
  },
  PAGINATION: {
    VALID_SIZE: 1000,
    MAX_SIZE: 5000,
  }
} as const;
