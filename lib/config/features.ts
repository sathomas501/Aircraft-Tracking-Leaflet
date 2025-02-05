// lib/config/features.ts
import { WEBSOCKET_CONFIG } from '@/config/websocket';
import {AIRCRAFT_CONSTANTS} from '.././../constants/aircraft'
import { MONITORING_CONSTANTS } from '@/constants/monitoring';
import { RETRY_CONFIG } from '@/config/retry';


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
      maxRetries: WEBSOCKET_CONFIG.RECONNECT.MAX_ATTEMPTS,
      reconnectDelay: RETRY_CONFIG.INITIAL_DELAY,
      pingInterval: WEBSOCKET_CONFIG.TIMEOUTS.PING_INTERVAL
    }
  },

  AUTO_RECONNECT: {
    name: 'autoReconnect',
    description: 'Enable automatic reconnection for failed connections',
    enabled: true,
    dependencies: ['websocket'],
    config: {
      maxAttempts: RETRY_CONFIG.MAX_ATTEMPTS,
      backoffFactor: RETRY_CONFIG.BACKOFF_FACTOR
    }
  },

  STALE_DATA_CHECK: {
    name: 'staleDataCheck',
    description: 'Enable checking for stale aircraft data',
    enabled: true,
    config: {
      threshold: AIRCRAFT_CONSTANTS.LIMITS.STALE_THRESHOLD
    }
  },

  QUEUE_MONITORING: {
    name: 'queueMonitoring',
    description: 'Enable monitoring of request queues',
    enabled: true,
    dependencies: ['advancedMetrics'],
    config: {
      warningThreshold: MONITORING_CONSTANTS.THRESHOLDS.QUEUE_WARNING,
      criticalThreshold: MONITORING_CONSTANTS.THRESHOLDS.QUEUE_CRITICAL
    }
  }
} as const;