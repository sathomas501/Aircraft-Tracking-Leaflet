export const AIRCRAFT = {
  LAYERS: { SELECTED: 1000, AIRBORNE: 100, GROUNDED: 0 },
  STATUS: {
    AIRBORNE: { LABEL: '✈️ Airborne', COLOR: 'text-blue-600', EMOJI: '✈️' },
    GROUNDED: { LABEL: '🛬 On Ground', COLOR: 'text-gray-600', EMOJI: '🛬' },
  },
  MARKERS: {
    SIZE: { DEFAULT: 24, SELECTED: 32 },
    COLORS: { DEFAULT: '#4b5563', SELECTED: '#2563eb' },
    OPACITY: { ACTIVE: 1, GROUNDED: 0.7 },
  },
  DEFAULT_STATE: {
    selectedManufacturer: '',
    selectedModel: '',
    selectedType: '',
    selectedAircraftId: null as string | null,
    nNumber: '',
  },
  CONVERSIONS: { MPS_TO_MPH: 2.237, METERS_TO_FEET: 3.28084 },
} as const;

export const VALID_PAGE_SIZE = 1000;
export const MAX_PAGE_SIZE = 5000;

// OpenSky-related constants
export const API_ENDPOINTS = ["https://opensky-network.org/apistates/all?"];
export const ICAO24_INDEX = 0;
export const LONGITUDE_INDEX = 5;
export const LATITUDE_INDEX = 6;
export const ALTITUDE_INDEX = 7;
export const VELOCITY_INDEX = 9;
export const HEADING_INDEX = 10;
export const ON_GROUND_INDEX = 8;
export const LAST_CONTACT_INDEX = 4;

export const VALID_AIRCRAFT_TYPES = ['4', '5', '6'] as const;
export type ValidAircraftType = typeof VALID_AIRCRAFT_TYPES[number];

export const TYPE_DESCRIPTIONS: Record<ValidAircraftType, string> = {
  '4': 'Fixed wing single engine',
  '5': 'Fixed wing multi engine',
  '6': 'Rotorcraft',
};
