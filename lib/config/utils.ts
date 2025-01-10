// lib/config/utils.ts
import { OPENSKY_CONFIG } from './opensky';

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
      baseDelay = OPENSKY_CONFIG.RETRY.BASE_DELAY,
      maxDelay = OPENSKY_CONFIG.RETRY.MAX_DELAY,
      backoffFactor = OPENSKY_CONFIG.RETRY.BACKOFF_FACTOR,
      jitter = OPENSKY_CONFIG.RETRY.JITTER
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
      ? OPENSKY_CONFIG.RATE_LIMITS.AUTHENTICATED 
      : OPENSKY_CONFIG.RATE_LIMITS.ANONYMOUS;
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
      Number(latitude.toFixed(OPENSKY_CONFIG.AIRCRAFT.COORDINATE_PRECISION)),
      Number(longitude.toFixed(OPENSKY_CONFIG.AIRCRAFT.COORDINATE_PRECISION))
    ];
  }

  /**
   * Validate altitude value
   */
  static validateAltitude(altitude: number): number {
    if (
      isNaN(altitude) || 
      altitude < OPENSKY_CONFIG.AIRCRAFT.MIN_ALTITUDE || 
      altitude > OPENSKY_CONFIG.AIRCRAFT.MAX_ALTITUDE
    ) {
      return OPENSKY_CONFIG.AIRCRAFT.DEFAULT_ALTITUDE;
    }
    return altitude;
  }

  /**
   * Check if data is stale based on last contact time
   */
  static isStaleData(lastContact: number): boolean {
    return Date.now() - lastContact > OPENSKY_CONFIG.AIRCRAFT.STALE_THRESHOLD;
  }

  /**
   * Get appropriate chunk size based on data size
   */
  static getChunkSize(dataSize: number): number {
    if (dataSize <= 100) return OPENSKY_CONFIG.BATCH.CHUNK_SIZE.SMALL;
    if (dataSize <= 500) return OPENSKY_CONFIG.BATCH.CHUNK_SIZE.MEDIUM;
    return OPENSKY_CONFIG.BATCH.CHUNK_SIZE.LARGE;
  }

  /**
   * Generate WebSocket close code description
   */
  static getWebSocketCloseReason(code: number): string {
    const codes = OPENSKY_CONFIG.WEBSOCKET.CLOSE_CODES;
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
    return queueSize >= OPENSKY_CONFIG.MONITORING.THRESHOLDS.QUEUE_WARNING;
  }

  /**
   * Check if queue size is at critical level
   */
  static isQueueCritical(queueSize: number): boolean {
    return queueSize >= OPENSKY_CONFIG.MONITORING.THRESHOLDS.QUEUE_CRITICAL;
  }

  /**
   * Get cache TTL for specific data type
   */
  static getCacheTTL(type: keyof typeof OPENSKY_CONFIG.CACHE.TTL): number {
    return OPENSKY_CONFIG.CACHE.TTL[type];
  }

  /**
   * Parse OpenSky state array into structured data
   */
  static parseStateArray(state: any[]): Record<string, any> | null {
    if (!Array.isArray(state) || state.length < 17) return null;

    const indices = OPENSKY_CONFIG.PARSER.INDICES;
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