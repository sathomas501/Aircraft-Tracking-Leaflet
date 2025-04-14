// src/config/opensky.ts
import { API_CONFIG } from './api';

export const OPENSKY_CONFIG = {
  API: {
    ENDPOINTS: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ALL_STATES}`,
  },
  AUTH: {
    USERNAME: process.env.OPEN_SKY_USER || '',
    PASSWORD: process.env.OPEN_SKY_PASS || '',
  },
  ERRORS: {
    CODES: {
      RATE_LIMIT: 'RATE_LIMIT',
      NETWORK: 'NETWORK',
      TIMEOUT: 'TIMEOUT',
      AUTH: 'AUTH',
      SERVER: 'SERVER',
      VALIDATION: 'VALIDATION',
    },
    HTTP: {
      RATE_LIMIT: 429,
      AUTH: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      SERVER_ERROR: 500,
    },
    MAX_ERROR_LOG_SIZE: 1000,
    ALERT_THRESHOLD: 10,
  },
} as const;
