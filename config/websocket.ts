// src/config/websocket.ts
export const WEBSOCKET_CONFIG = {
  RECONNECT: {
    MAX_ATTEMPTS: 5,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 30000,
    JITTER: 0.1,
  },
  TIMEOUTS: {
    PING_INTERVAL: 30000,
    PONG_TIMEOUT: 5000,
    CONNECTION_TIMEOUT: 10000,
  },
  CLOSE_CODES: {
    NORMAL: 1000,
    GOING_AWAY: 1001,
    PROTOCOL_ERROR: 1002,
    INVALID_DATA: 1003,
    POLICY_VIOLATION: 1008,
    MESSAGE_TOO_BIG: 1009,
    INTERNAL_ERROR: 1011,
  },
  MESSAGE_TYPES: {
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    UPDATE: 'update',
    ERROR: 'error',
    PING: 'ping',
    PONG: 'pong',
  },
} as const;