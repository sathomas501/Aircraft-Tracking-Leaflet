// Consolidated Error Handler File

import React from 'react';
import { NextApiResponse } from 'next';

// --- OpenSky Specific Errors ---
export class OpenSkyError extends Error {
  code: OpenSkyErrorCode;
  statusCode?: number;
  cause?: unknown;
  context?: any;

  constructor(
    message: string,
    code: OpenSkyErrorCode,
    statusCode?: number,
    cause?: unknown,
    context?: any
  ) {
    super(message);
    this.name = 'OpenSkyError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
    this.context = context;
    Error.captureStackTrace?.(this, OpenSkyError);
  }
}

export class OpenSkyRateLimitError extends OpenSkyError {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, OpenSkyErrorCode.RATE_LIMIT);
    this.name = 'OpenSkyRateLimitError';
    this.retryAfter = retryAfter;
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

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTHENTICATION = 'AUTHENTICATION',
  CACHE = 'CACHE',
  DATA = 'DATA',
  POLLING = 'POLLING',
  POLLING_TIMEOUT = 'POLLING_TIMEOUT',
  CRITICAL = 'CRITICAL',
  VALIDATION = 'VALIDATION',
  WEBSOCKET = 'WEBSOCKET',
  RATE_LIMIT = 'RATE_LIMIT',
  OPENSKY_AUTH = 'OPENSKY_AUTH',
  OPENSKY_RATE_LIMIT = 'OPENSKY_RATE_LIMIT',
  OPENSKY_DATA = 'OPENSKY_DATA',
  OPENSKY_TIMEOUT = 'OPENSKY_TIMEOUT',
  OPENSKY_INVALID_ICAO = 'OPENSKY_INVALID_ICAO',
  OPENSKY_SERVICE = 'OPENSKY_SERVICE',
  OPENSKY_REQUEST = 'OPENSKY_REQUEST',
  OPENSKY_POLLING = 'OPENSKY_POLLING',
  OPENSKY_CLEANUP = 'OPENSKY_CLEANUP',
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  timestamp: number;
  context?: any;
  retryCount: number;
  resolved: boolean;
  code?: number;
  lastRetryTimestamp?: number;
}

export interface ErrorState {
  errors: Map<ErrorType, ErrorDetails>;
  handlers: Map<ErrorType, Set<(error: ErrorDetails) => void>>;
  retryTimeouts: Map<ErrorType, NodeJS.Timeout>;
}

export function handleApiError(res: NextApiResponse, error: unknown): void {
  errorHandler.handleError(ErrorType.OPENSKY_SERVICE, 'API Error', error);

  res.status(500).json({
    error: userMessages[ErrorType.OPENSKY_SERVICE],
    success: false,
  });
}

// User-friendly messages for errors
export const userMessages: Record<ErrorType, string> = {
  [ErrorType.NETWORK]:
    'A network issue occurred. Please check your connection.',
  [ErrorType.AUTH]: 'Authentication failed. Please log in again.',
  [ErrorType.AUTH_REQUIRED]: 'Authentication is required to proceed.',
  [ErrorType.AUTHENTICATION]: 'Authentication error occurred.',
  [ErrorType.CACHE]: 'A cache error occurred.',
  [ErrorType.VALIDATION]: 'Validation error occurred.',
  [ErrorType.DATA]: 'An issue occurred while processing data.',
  [ErrorType.POLLING]:
    'An error occurred during polling. Please try again later.',
  [ErrorType.POLLING_TIMEOUT]: 'Polling timed out. Please try again.',
  [ErrorType.CRITICAL]: 'A critical error occurred. Please contact support.',
  [ErrorType.WEBSOCKET]: 'A WebSocket error occurred. Reconnecting...',
  [ErrorType.RATE_LIMIT]:
    'Rate limit exceeded. Please wait before making more requests.',
  // Added OpenSky specific error messages
  [ErrorType.OPENSKY_AUTH]:
    'OpenSky authentication failed. Please check your credentials.',
  [ErrorType.OPENSKY_RATE_LIMIT]:
    'OpenSky rate limit reached. Please wait before tracking more aircraft.',
  [ErrorType.OPENSKY_DATA]: 'Unable to retrieve aircraft data from OpenSky.',
  [ErrorType.OPENSKY_TIMEOUT]: 'OpenSky request timed out. Please try again.',
  [ErrorType.OPENSKY_INVALID_ICAO]:
    'Invalid ICAO24 code provided. Please check the aircraft identifier.',
  [ErrorType.OPENSKY_SERVICE]:
    'OpenSky service is currently unavailable. Please try again later.',
  [ErrorType.OPENSKY_REQUEST]: 'Missing or invalid ICAO24 codes.',
  [ErrorType.OPENSKY_POLLING]: 'Opensky polling error',
  [ErrorType.OPENSKY_CLEANUP]: 'Opensky cleanup on aisle 01100101 error',
};

export enum OpenSkyErrorCode {
  INVALID_DATA = 'INVALID_DATA',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  POLLING_ERROR = 'POLLING_ERROR',
  CLEANUP_ERROR = 'CLEANUP_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTHENTICATION = 'AUTHENTICATION',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  WEBSOCKET = 'WEBSOCKET',
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly MAX_RETRY_COUNT = 5;
  private state: ErrorState = {
    errors: new Map(),
    handlers: new Map(),
    retryTimeouts: new Map(),
  };
  private readonly BASE_RETRY_DELAY = 2000;
  private readonly MAX_RETRY_DELAY = 32000;

  // Added retry configurations for specific error types
  private readonly retryConfig: Partial<
    Record<ErrorType, { maxRetries: number; baseDelay: number }>
  > = {
    [ErrorType.OPENSKY_AUTH]: { maxRetries: 3, baseDelay: 5000 },
    [ErrorType.OPENSKY_RATE_LIMIT]: { maxRetries: 5, baseDelay: 10000 },
    [ErrorType.OPENSKY_TIMEOUT]: { maxRetries: 3, baseDelay: 3000 },
    [ErrorType.OPENSKY_SERVICE]: { maxRetries: 4, baseDelay: 15000 },
  };

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(
    errorOrType: ErrorType | ErrorDetails,
    message?: string | Error,
    context?: any
  ): void {
    let error: ErrorDetails;

    if (typeof errorOrType === 'string') {
      error = {
        type: errorOrType,
        message:
          message instanceof Error
            ? message.message
            : message || 'An error occurred',
        timestamp: Date.now(),
        retryCount: 0,
        resolved: false,
        context: context,
      };
    } else {
      error = errorOrType;
    }

    console.error(
      `[ErrorHandler] ${error.type}:`,
      error.message,
      error.context
    );

    // Add the error to the state
    this.state.errors.set(error.type, error);

    // Notify subscribed handlers
    this.notifyHandlers(error);

    // Log the error
    this.logError(error);

    // Get retry configuration for this error type
    const retryConfig = this.retryConfig[error.type];
    const maxRetries = retryConfig?.maxRetries ?? this.MAX_RETRY_COUNT;

    // Handle retry logic if applicable
    if (error.retryCount < maxRetries && this.shouldRetry(error.type)) {
      this.scheduleRetry(error);
    }
  }

  private shouldRetry(errorType: ErrorType): boolean {
    // Define which error types should be retried
    const retryableErrors = new Set([
      ErrorType.NETWORK,
      ErrorType.OPENSKY_AUTH,
      ErrorType.OPENSKY_TIMEOUT,
      ErrorType.OPENSKY_SERVICE,
      ErrorType.OPENSKY_RATE_LIMIT,
    ]);

    return retryableErrors.has(errorType);
  }

  private notifyHandlers(error: ErrorDetails): void {
    const handlers = this.state.handlers.get(error.type);
    if (handlers) {
      handlers.forEach((handler) => handler(error));
    }
  }

  public subscribeToError(
    type: ErrorType,
    handler: (error: ErrorDetails) => void
  ): void {
    if (!this.state.handlers.has(type)) {
      this.state.handlers.set(type, new Set());
    }
    this.state.handlers.get(type)?.add(handler);
  }

  public unsubscribeFromError(
    type: ErrorType,
    handler: (error: ErrorDetails) => void
  ): void {
    this.state.handlers.get(type)?.delete(handler);
  }

  private getRetryDelay(error: ErrorDetails): number {
    const config = this.retryConfig[error.type];
    const baseDelay = config?.baseDelay ?? this.BASE_RETRY_DELAY;

    const delay = Math.min(
      baseDelay * Math.pow(2, error.retryCount),
      this.MAX_RETRY_DELAY
    );
    return delay + Math.random() * 500; // Add jitter
  }

  private scheduleRetry(error: ErrorDetails): void {
    const retryDelay = this.getRetryDelay(error);
    const timeout = setTimeout(() => {
      error.retryCount++;
      error.lastRetryTimestamp = Date.now();
      this.handleError(error);
    }, retryDelay);

    this.state.retryTimeouts.set(error.type, timeout);
  }

  private logError(error: ErrorDetails): void {
    // Example integration with external logging service
    console.log('[ErrorHandler] Logging error:', {
      type: error.type,
      message: error.message,
      context: error.context,
      retryCount: error.retryCount,
      timestamp: error.timestamp,
    });
  }

  public clearError(type: ErrorType): void {
    this.state.errors.delete(type);
    const timeout = this.state.retryTimeouts.get(type);
    if (timeout) {
      clearTimeout(timeout);
      this.state.retryTimeouts.delete(type);
    }
  }

  public getActiveErrors(): ErrorDetails[] {
    return Array.from(this.state.errors.values());
  }
}

// React hook for using the error handler
export function useErrorHandler(type: ErrorType) {
  const [error, setError] = React.useState<ErrorDetails | null>(null);

  React.useEffect(() => {
    const handler = (errorDetails: ErrorDetails) => {
      setError(errorDetails);
    };

    errorHandler.subscribeToError(type, handler);

    return () => {
      errorHandler.unsubscribeFromError(type, handler);
    };
  }, [type]);

  return {
    error,
    clearError: () => {
      setError(null);
      errorHandler.clearError(type);
    },
  };
}

// Create and export singleton instance
export const errorHandler = ErrorHandler.getInstance();
