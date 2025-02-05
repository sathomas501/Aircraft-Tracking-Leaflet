// config/api.ts
export const API_CONFIG = {
  BASE_URL: 'https://opensky-network.org/api',
  WS_URL: 'wss://opensky-network.org/api/ws',
  ENDPOINTS: {
    ALL_STATES: '/states/all',
    WEBSOCKET: '/websocket',
  },
  HEADERS: {
    ACCEPT: 'application/json',
    CONTENT_TYPE: 'application/json',
  },
  TIMEOUT: {
    DEFAULT: 10000,
    WEBSOCKET: 30000,
    LONG_POLL: 60000,
  },
  PARAMS: {
    ICAO24: 'icao24',
    TIME: 'time',
    EXTENDED: 'extended',
    MAX_ICAO_QUERY: 200,
    MAX_TOTAL_ICAO_QUERY: 1000
  },

  API: {
    MIN_POLLING_INTERVAL: 5000,
    MAX_POLLING_INTERVAL: 30000,
    TIMEOUT_MS: 15000,
    DEFAULT_RETRY_LIMIT: 3,
    MAX_RETRY_LIMIT: 5
}} as const;