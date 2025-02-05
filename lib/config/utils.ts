// lib/config/utils.ts
import { RETRY_CONFIG } from '../../config/retry';
import { PARSER_CONSTANTS } from '@/constants/parsers';
import { CACHE_CONFIG } from '../../config/cache';
import { MONITORING_CONSTANTS } from '@/constants/monitoring';
import { WEBSOCKET_CONFIG } from '@/config/websocket';
import { AIRCRAFT_CONSTANTS } from '@/constants/aircraft';
import { RATE_LIMITS } from '@/config/rate-limits';





export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: number;
}

export class ConfigUtils {
  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  static getRetryDelay(attempt: number, options: RetryOptions = {}): number {
    const {
      baseDelay = RETRY_CONFIG.INITIAL_DELAY,
      maxDelay = RETRY_CONFIG.MAX_DELAY,
      backoffFactor = RETRY_CONFIG.BACKOFF_FACTOR,
      jitter = RETRY_CONFIG.JITTER
    } = options;

    // Calculate base exponential delay
    const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt - 1);
    
    // Apply max delay limit
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // Apply jitter
    const jitterMs = cappedDelay * jitter;
    return cappedDelay + (Math.random() * 2 - 1) * jitterMs;
  }

  /**
   * Get rate limit configuration based on authentication status
   */
  static getRateLimitConfig(isAuthenticated: boolean) {
    return isAuthenticated 
      ? RATE_LIMITS.AUTHENTICATED 
      : RATE_LIMITS.ANONYMOUS;
  }

  /**
   * Get batch size based on authentication status and custom requirements
   */
  static getBatchSize(isAuthenticated: boolean, customSize?: number) {
    const config = this.getRateLimitConfig(isAuthenticated);
    if (!customSize) return config.BATCH_SIZE;
    
    return Math.min(
      customSize,
      config.BATCH_SIZE
    );
  }

  /**
   * Validate and normalize coordinates
   */
  static normalizeCoordinates(latitude: number, longitude: number): [number, number] | null {
    if (
      isNaN(latitude) || 
      isNaN(longitude) ||
      latitude < -90 || 
      latitude > 90 ||
      longitude < -180 || 
      longitude > 180
    ) {
      return null;
    }

    return [
      Number(latitude.toFixed(AIRCRAFT_CONSTANTS.LIMITS.COORDINATE_PRECISION)),
      Number(longitude.toFixed(AIRCRAFT_CONSTANTS.LIMITS.COORDINATE_PRECISION))
    ];
  }

  /**
   * Validate altitude value
   */
  static validateAltitude(altitude: number): number {
    if (
      isNaN(altitude) || 
      altitude < AIRCRAFT_CONSTANTS.LIMITS.MIN_ALTITUDE || 
      altitude > AIRCRAFT_CONSTANTS.LIMITS.MAX_ALTITUDE
    ) {
      return AIRCRAFT_CONSTANTS.LIMITS.DEFAULT_ALTITUDE;
    }
    return altitude;
  }

  /**
   * Check if data is stale based on last contact time
   */
  static isStaleData(lastContact: number): boolean {
    return Date.now() - lastContact > AIRCRAFT_CONSTANTS.LIMITS.STALE_THRESHOLD;
  }

  /**
   * Get appropriate chunk size based on data size
   */
  static getChunkSize(dataSize: number): number {
    if (dataSize <= 100) return CACHE_CONFIG.CHUNK_SIZE.SMALL;
    if (dataSize <= 500) return CACHE_CONFIG.CHUNK_SIZE.MEDIUM;
    return CACHE_CONFIG.CHUNK_SIZE.LARGE;
  }
  /**
   * Generate WebSocket close code description
   */
  static getWebSocketCloseReason(code: number): string {
    const codes = WEBSOCKET_CONFIG.CLOSE_CODES;
    switch (code) {
      case codes.NORMAL: return 'Normal closure';
      case codes.GOING_AWAY: return 'Client going away';
      case codes.PROTOCOL_ERROR: return 'Protocol error';
      case codes.INVALID_DATA: return 'Invalid data';
      case codes.POLICY_VIOLATION: return 'Policy violation';
      case codes.MESSAGE_TOO_BIG: return 'Message too big';
      case codes.INTERNAL_ERROR: return 'Internal error';
      default: return 'Unknown close code';
    }
  }

  /**
   * Check if queue size is at warning level
   */
  static isQueueWarning(queueSize: number): boolean {
    return queueSize >= MONITORING_CONSTANTS.THRESHOLDS.QUEUE_WARNING;
  }

  /**
   * Check if queue size is at critical level
   */
  static isQueueCritical(queueSize: number): boolean {
    return queueSize >= MONITORING_CONSTANTS.THRESHOLDS.QUEUE_CRITICAL;
  }

  /**
   * Get cache TTL for specific data type
   */
  static getCacheTTL(type: 'DEFAULT' | 'POSITION' | 'METADATA' | 'ERROR'): number {
    return CACHE_CONFIG.TTL[type];
  }

  /**
   * Parse OpenSky state array into structured data
   */
  static parseStateArray(state: any[]): Record<string, any> | null {
    if (!Array.isArray(state) || state.length < 17) return null;

    const indices = PARSER_CONSTANTS.INDICES;
    return {
      icao24: state[indices.ICAO24],
      callsign: state[indices.CALLSIGN],
      origin_country: state[indices.ORIGIN_COUNTRY],
      time_position: state[indices.TIME_POSITION],
      last_contact: state[indices.LAST_CONTACT],
      longitude: state[indices.LONGITUDE],
      latitude: state[indices.LATITUDE],
      baro_altitude: state[indices.BARO_ALTITUDE],
      on_ground: state[indices.ON_GROUND],
      velocity: state[indices.VELOCITY],
      true_track: state[indices.TRUE_TRACK],
      vertical_rate: state[indices.VERTICAL_RATE],
      sensors: state[indices.SENSORS],
      geo_altitude: state[indices.GEO_ALTITUDE],
      squawk: state[indices.SQUAWK],
      spi: state[indices.SPI],
      position_source: state[indices.POSITION_SOURCE]
    };
  }
}