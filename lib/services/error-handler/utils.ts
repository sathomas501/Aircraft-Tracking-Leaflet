// lib/services/error-handler/utils.ts
import { ErrorType, ErrorMessages, AppError } from './types';

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

export function getErrorTypeAndMessage(error: unknown): { type: ErrorType; message: string } {
    // Handle AppError instances
    if (error instanceof AppError) {
        return {
            type: error.code,
            message: error.message
        };
    }

    // Handle standard Error instances
    if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('Network')) {
            return {
                type: ErrorType.NETWORK,
                message: ErrorMessages[ErrorType.NETWORK]
            };
        }
        return {
            type: ErrorType.UNKNOWN,
            message: error.message
        };
    }

    // Handle API error responses
    if (isApiErrorResponse(error)) {
        if (error.status === 429) {
            return {
                type: ErrorType.RATE_LIMIT,
                message: error.message || ErrorMessages[ErrorType.RATE_LIMIT]
            };
        }
        if (error.status === 404) {
            return {
                type: ErrorType.API,
                message: 'Resource not found'
            };
        }
        if (error.status === 401 || error.status === 403) {
            return {
                type: ErrorType.AUTH,
                message: 'Access denied'
            };
        }
        if (error.status >= 500) {
            return {
                type: ErrorType.API,
                message: 'Server error occurred'
            };
        }
        return {
            type: ErrorType.API,
            message: error.message || error.statusText || ErrorMessages[ErrorType.API]
        };
    }

    // Handle string errors
    if (typeof error === 'string') {
        return {
            type: ErrorType.UNKNOWN,
            message: error
        };
    }

    // Handle objects with message property
    if (error && typeof error === 'object' && 'message' in error) {
        return {
            type: ErrorType.UNKNOWN,
            message: String(error.message)
        };
    }

    // Default error handling
    return {
        type: ErrorType.UNKNOWN,
        message: ErrorMessages[ErrorType.UNKNOWN]
    };
}