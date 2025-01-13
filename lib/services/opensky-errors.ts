// lib/services/opensky-errors.ts
export class OpenSkyError extends Error {
  constructor(
    message: string,
    public readonly code: OpenSkyErrorCode,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OpenSkyError';
  }
}

export enum OpenSkyErrorCode {
  RATE_LIMIT = 'RATE_LIMIT',
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  INVALID_DATA = 'INVALID_DATA',
  WEBSOCKET = 'WEBSOCKET',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

export class OpenSkyRateLimitError extends OpenSkyError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, OpenSkyErrorCode.RATE_LIMIT);
    this.name = 'OpenSkyRateLimitError';
  }
}

export class OpenSkyAuthenticationError extends OpenSkyError {
  constructor(message: string) {
    super(message, OpenSkyErrorCode.AUTHENTICATION, 401);
    this.name = 'OpenSkyAuthenticationError';
  }
}

export class OpenSkyWebSocketError extends OpenSkyError {
  constructor(message: string, cause?: unknown) {
    super(message, OpenSkyErrorCode.WEBSOCKET, undefined, cause);
    this.name = 'OpenSkyWebSocketError';
  }
}