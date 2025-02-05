// src/constants/monitoring.ts
export const MONITORING_CONSTANTS = {
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
    SLOW_REQUEST: 5000,
    HIGH_ERROR_RATE: 0.1,
    LOW_CACHE_HIT_RATE: 0.8,
    QUEUE_WARNING: 100,
    QUEUE_CRITICAL: 500
  }
} as const;