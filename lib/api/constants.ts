//lib/api/constants.ts

export const API_ENDPOINTS = {
  OPENSKY_BASE: 'https://opensky-network.org/api' as const,
  OPENSKY_STATES: '/states/all?' as const,
  LOCAL_MANUFACTURERS: '/api/manufacturers' as const,
  LOCAL_OPENSKY: '/api/opensky' as const,
  LOCAL_ICAO24: '/api/aircraft/icao24s' as const
} as const;


export const ICAO24_INDEX = 0;
export const LONGITUDE_INDEX = 5;
export const LATITUDE_INDEX = 6;
export const ALTITUDE_INDEX = 13;
export const VELOCITY_INDEX = 9;
export const HEADING_INDEX = 10;
export const ON_GROUND_INDEX = 8;
export const LAST_CONTACT_INDEX = 4;

// constants.ts
export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY = 2000;
export const WS_RECONNECT_DELAY = 5000;


export const API_PARAMS = {
  ICAO24: 'icao24',
  ICAO24S: 'icao24s',
  MANUFACTURER: 'manufacturer'
} as const;
