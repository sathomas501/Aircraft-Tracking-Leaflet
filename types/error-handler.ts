// types/error-handler.ts

/**
 * Types of errors that can occur in the application
 */
export enum ErrorType {
    NETWORK = 'NETWORK',    // Network-related errors (HTTP, fetch, etc.)
    AUTH = 'AUTH',         // Authentication and authorization errors
    RATE_LIMIT = 'RATE_LIMIT', // API rate limiting errors
    DATA = 'DATA',         // Data processing or validation errors
    WEBSOCKET = 'WEBSOCKET' // WebSocket connection or message errors
}

/**
 * Details about an error occurrence
 */
export interface ErrorDetails {
    type: ErrorType;
    message: string;
    retryAfter?: number;    // Seconds to wait before retry (for rate limiting)
    timestamp: number;      // Unix timestamp of error occurrence
    context?: any;          // Additional context about the error
    retryCount?: number;    // Number of retry attempts made
    resolved?: boolean;     // Whether the error has been resolved
}

/**
 * Internal state for error handling
 */
export interface ErrorState {
    errors: Map<ErrorType, ErrorDetails>;
    handlers: Map<ErrorType, Set<(error: ErrorDetails) => void>>;
    retryTimeouts: Map<ErrorType, NodeJS.Timeout>;
}

/**
 * Return type for useErrorHandler hook
 */
export interface ErrorHandlerHook {
    error: ErrorDetails | null;
    isRetrying: boolean;
    nextRetry: number | null;
    clear: () => void;
}

/**
 * Status of retry attempts for an error type
 */
export interface RetryStatus {
    retrying: boolean;
    nextRetry: number | null;
}