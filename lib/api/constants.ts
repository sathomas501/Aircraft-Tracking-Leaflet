// lib/api/constants.ts
export const API_ENDPOINTS = {
  OPENSKY_BASE: 'https://opensky-network.org/api',
  OPENSKY_STATES: '/states/all',
  OPENSKY_WEBSOCKET: '/websocket'
} as const;


export const WS_CONFIG = {
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000, // Initial delay in milliseconds
  MAX_RECONNECT_DELAY: 30000, // Maximum delay in milliseconds (30 seconds)
  PING_INTERVAL: 30000, // Send ping every 30 seconds
  PONG_TIMEOUT: 5000, // Wait 5 seconds for pong response
  CONNECTION_TIMEOUT: 10000 // Initial connection timeout
} as const;


export const RATE_LIMITS = {
  ANONYMOUS: {
    requestsPerMinute: 100,
    requestsPerDay: 10000,
    batchSize: 25,
    minInterval: 5000,
  },
  AUTHENTICATED: {
    requestsPerMinute: 300,
    requestsPerDay: 50000,
    batchSize: 100,
    minInterval: 1000,
  }
} as const;


export const API_PARAMS = {
  ICAO24: 'icao24',
  TIME: 'time',
  EXTENDED: 'extended'
} as const;


// OpenSky State Vector Array Indices
export const OPENSKY_INDICES = {
  ICAO24: 0,
  CALLSIGN: 1,
  ORIGIN_COUNTRY: 2,
  TIME_POSITION: 3,
  LAST_CONTACT: 4,
  LONGITUDE: 5,
  LATITUDE: 6,
  BARO_ALTITUDE: 7,
  ON_GROUND: 8,
  VELOCITY: 9,
  TRUE_TRACK: 10,
  VERTICAL_RATE: 11,
  SENSORS: 12,
  GEO_ALTITUDE: 13,
  SQUAWK: 14,
  SPI: 15,
  POSITION_SOURCE: 16
} as const;

export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_FACTOR: 2
} as const;

export const CACHE_CONFIG = {
  TTL: 15, // seconds
  CLEANUP_INTERVAL: 60000, // 1 minute
  POSITION_MAX_AGE: 60000 // 1 minute
} as const;

export const WEBSOCKET_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  INITIAL_RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 30000
} as const;