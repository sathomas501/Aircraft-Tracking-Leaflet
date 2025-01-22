// lib/config/opensky.ts
import {API_ENDPOINTS} from '@/lib/api/constants'

export const OPENSKY_CONFIG = {
  // API Configuration
  API: {
    ENDPOINTS: `${API_ENDPOINTS.OPENSKY_BASE}${API_ENDPOINTS.OPENSKY_STATES}`,
    TIMEOUT: {
      DEFAULT: 10000,
      WEBSOCKET: 30000,
      LONG_POLL: 60000
    },
    HEADERS: {
      ACCEPT: 'application/json',
      CONTENT_TYPE: 'application/json'
    }
  },

  // Rate Limiting Configuration
  RATE_LIMITS: {
    ANONYMOUS: {
      REQUESTS_PER_MINUTE: 100,
      REQUESTS_PER_DAY: 10000,
      BATCH_SIZE: 25,
      MIN_INTERVAL: 5000, // 5 seconds
      MAX_CONCURRENT: 2
    },
    AUTHENTICATED: {
      REQUESTS_PER_MINUTE: 300,
      REQUESTS_PER_DAY: 50000,
      BATCH_SIZE: 100,
      MIN_INTERVAL: 1000, // 1 second
      MAX_CONCURRENT: 5
    }
  },

  // WebSocket Configuration
  WEBSOCKET: {
    RECONNECT: {
      MAX_ATTEMPTS: 5,
      BASE_DELAY: 1000,
      MAX_DELAY: 30000,
      JITTER: 0.1 // 10% random jitter
    },
    PING_INTERVAL: 30000,
    CLOSE_CODES: {
      NORMAL: 1000,
      GOING_AWAY: 1001,
      PROTOCOL_ERROR: 1002,
      INVALID_DATA: 1003,
      POLICY_VIOLATION: 1008,
      MESSAGE_TOO_BIG: 1009,
      INTERNAL_ERROR: 1011
    },
    MESSAGE_TYPES: {
      SUBSCRIBE: 'subscribe',
      UNSUBSCRIBE: 'unsubscribe',
      UPDATE: 'update',
      ERROR: 'error',
      PING: 'ping',
      PONG: 'pong'
    }
  },

  // Cache Configuration
  CACHE: {
    TTL: {
      DEFAULT: 15, // 15 seconds
      POSITION: 15,
      METADATA: 3600, // 1 hour
      ERROR: 300 // 5 minutes
    },
    MAX_SIZE: 1000,
    CHECK_PERIOD: 60, // Cleanup every 60 seconds
    MAX_KEYS: 10000
  },

  // Retry Configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 2000,
    MAX_DELAY: 10000,
    BACKOFF_FACTOR: 2,
    JITTER: 0.1 // 10% random jitter
  },

  // Batch Processing Configuration
  BATCH: {
    MAX_SIZE: {
      ANONYMOUS: 25,
      AUTHENTICATED: 100
    },
    QUEUE_TIMEOUT: 100, // ms to wait before processing queue
    MAX_QUEUE_SIZE: 1000,
    CHUNK_SIZE: {
      SMALL: 25,
      MEDIUM: 50,
      LARGE: 100
    }
  },

  // Aircraft Data Configuration
  AIRCRAFT: {
    UPDATE_INTERVAL: 5000, // 5 seconds
    STALE_THRESHOLD: 300000, // 5 minutes
    DEFAULT_ALTITUDE: 0,
    MIN_ALTITUDE: -2000, // feet
    MAX_ALTITUDE: 60000, // feet
    MIN_VELOCITY: 0, // knots
    MAX_VELOCITY: 1000, // knots
    COORDINATE_PRECISION: 6
  },

  // Error Handling Configuration
  ERRORS: {
    CODES: {
      RATE_LIMIT: 'RATE_LIMIT',
      NETWORK: 'NETWORK',
      TIMEOUT: 'TIMEOUT',
      AUTH: 'AUTH',
      SERVER: 'SERVER',
      VALIDATION: 'VALIDATION'
    },
    HTTP: {
      RATE_LIMIT: 429,
      AUTH: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      SERVER_ERROR: 500
    },
    MAX_ERROR_LOG_SIZE: 1000,
    ALERT_THRESHOLD: 10 // Number of errors before alerting
  },

  // Response Parsing Configuration
  PARSER: {
    INDICES: {
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
    },
    DEFAULT_VALUES: {
      ALTITUDE: 0,
      VELOCITY: 0,
      HEADING: 0,
      VERTICAL_RATE: 0
    }
  },

  // Performance Monitoring
  MONITORING: {
    METRICS: {
      REQUEST_DURATION: 'opensky_request_duration',
      ERROR_COUNT: 'opensky_error_count',
      CACHE_HITS: 'opensky_cache_hits',
      CACHE_MISSES: 'opensky_cache_misses',
      ACTIVE_WEBSOCKETS: 'opensky_active_websockets',
      QUEUE_SIZE: 'opensky_queue_size',
      RATE_LIMIT_REMAINING: 'opensky_rate_limit_remaining'
    },
    THRESHOLDS: {
      SLOW_REQUEST: 5000, // 5 seconds
      HIGH_ERROR_RATE: 0.1, // 10%
      LOW_CACHE_HIT_RATE: 0.8, // 80%
      QUEUE_WARNING: 100,
      QUEUE_CRITICAL: 500
    }
  }
} as const;

export const OPENSKY_API_CONFIG = {
  BASE_URL: 'https://opensky-network.org/api', // API Base URL
  ENDPOINTS: {
    ALL_STATES: '/states/all', // Endpoint for fetching aircraft positions
  },
  HEADERS: {
    'Content-Type': 'application/json',
  },
  AUTH: {
    USERNAME: process.env.OPEN_SKY_USER || '', // Optional: OpenSky username
    PASSWORD: process.env.OPEN_SKY_PASS || '', // Optional: OpenSky password
  },
  CACHE: {
    TTL: {
      POSITION: 15, // Cache TTL for positions in seconds
    },
  },
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 100, // Adjust based on API limits
    REQUESTS_PER_DAY: 10000, // Adjust based on API limits
    BATCH_SIZE: 100, // Maximum number of ICAO24s per request
  },
  PARSER: {
    INDICES: {
      ICAO24: 0,
      LATITUDE: 1,
      LONGITUDE: 2,
      BARO_ALTITUDE: 7,
      VELOCITY: 9,
    },
  },
};
