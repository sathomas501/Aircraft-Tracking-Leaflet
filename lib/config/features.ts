// lib/config/features.ts
import { OPENSKY_CONFIG } from './opensky';

export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  enabledFor?: string[];
  disabledFor?: string[];
  rolloutPercentage?: number;
  validUntil?: string;
  dependencies?: string[];
  config?: Record<string, any>;
}

export const FEATURES: Record<string, FeatureFlag> = {
  WEBSOCKET: {
    name: 'websocket',
    description: 'Enable WebSocket connections for real-time updates',
    enabled: true,
    dependencies: [],
    config: {
      maxRetries: OPENSKY_CONFIG.WEBSOCKET.RECONNECT.MAX_ATTEMPTS,
      reconnectDelay: OPENSKY_CONFIG.WEBSOCKET.RECONNECT.BASE_DELAY,
      pingInterval: OPENSKY_CONFIG.WEBSOCKET.PING_INTERVAL
    }
  },

  AUTO_RECONNECT: {
    name: 'autoReconnect',
    description: 'Enable automatic reconnection for failed connections',
    enabled: true,
    dependencies: ['websocket'],
    config: {
      maxAttempts: OPENSKY_CONFIG.RETRY.MAX_ATTEMPTS,
      backoffFactor: OPENSKY_CONFIG.RETRY.BACKOFF_FACTOR
    }
  },

  STALE_DATA_CHECK: {
    name: 'staleDataCheck',
    description: 'Enable checking for stale aircraft data',
    enabled: true,
    config: {
      threshold: OPENSKY_CONFIG.AIRCRAFT.STALE_THRESHOLD
    }
  },

  QUEUE_MONITORING: {
    name: 'queueMonitoring',
    description: 'Enable monitoring of request queues',
    enabled: true,
    dependencies: ['advancedMetrics'],
    config: {
      warningThreshold: OPENSKY_CONFIG.MONITORING.THRESHOLDS.QUEUE_WARNING,
      criticalThreshold: OPENSKY_CONFIG.MONITORING.THRESHOLDS.QUEUE_CRITICAL
    }
  }
} as const;