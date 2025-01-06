// utils/errors.ts

/**
 * Standard error codes for the application
 */
export const ErrorCodes = {
  NETWORK: 'NETWORK_ERROR',
  API: 'API_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  POSITION: 'POSITION_ERROR',
  DATA_LOAD: 'DATA_LOAD_ERROR',
  WEBSOCKET: 'WEBSOCKET_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
} as const;

/**
 * Standard error messages for the application
 */
export const ErrorMessages = {
  NETWORK: 'Network error occurred. Please check your connection.',
  API: 'API request failed. Please try again.',
  VALIDATION: 'Please check your input and try again.',
  POSITION: 'Failed to update aircraft positions.',
  DATA_LOAD: 'Failed to load aircraft data.',
  WEBSOCKET: 'WebSocket connection failed.',
  UNKNOWN: 'An unknown error occurred.'
} as const;

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

/**
 * Type guard to check if an object is an API error response
 */
export function isApiErrorResponse(error: unknown): error is { 
  status: number; 
  statusText?: string; 
  message?: string;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as any).status === 'number'
  );
}

/**
 * Gets a user-friendly error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  // Handle AppError instances
  if (error instanceof AppError) {
    return error.message;
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    if (error.message.includes('network') || error.message.includes('Network')) {
      return ErrorMessages.NETWORK;
    }
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle API error responses
  if (isApiErrorResponse(error)) {
    if (error.status === 404) {
      return 'Resource not found';
    }
    if (error.status === 401 || error.status === 403) {
      return 'Access denied';
    }
    if (error.status >= 500) {
      return 'Server error occurred';
    }
    // Use provided message or statusText if available
    return error.message || error.statusText || ErrorMessages.API;
  }

  // Handle objects with message property
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  // Default error message
  return ErrorMessages.UNKNOWN;
}
