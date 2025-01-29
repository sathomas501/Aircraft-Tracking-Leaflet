import React from 'react';

export enum ErrorType {
    NETWORK = 'NETWORK',
    AUTH = 'AUTH',
    AUTH_REQUIRED = 'AUTH_REQUIRED',
    DATA = 'DATA',
    POLLING = 'POLLING',
    POLLING_TIMEOUT = 'POLLING_TIMEOUT',
    CRITICAL = 'CRITICAL',
    WEBSOCKET = 'WEBSOCKET',
    RATE_LIMIT = 'RATE_LIMIT'
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

interface ErrorState {
    errors: Map<ErrorType, ErrorDetails>;
    handlers: Map<ErrorType, Set<(error: ErrorDetails) => void>>;
    retryTimeouts: Map<ErrorType, NodeJS.Timeout>;
}

// User-friendly messages for errors
export const userMessages: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: 'A network issue occurred. Please check your connection.',
    [ErrorType.AUTH]: 'Authentication failed. Please log in again.',
    [ErrorType.AUTH_REQUIRED]: 'Authentication is required to proceed.',
    [ErrorType.DATA]: 'An issue occurred while processing data.',
    [ErrorType.POLLING]: 'An error occurred during polling. Please try again later.',
    [ErrorType.POLLING_TIMEOUT]: 'Polling timed out. Please try again.',
    [ErrorType.CRITICAL]: 'A critical error occurred. Please contact support.',
    [ErrorType.WEBSOCKET]: 'A WebSocket error occurred. Reconnecting...',
    [ErrorType.RATE_LIMIT]: 'Rate limit exceeded. Please wait before making more requests.'
};

export class ErrorHandler {
    private static instance: ErrorHandler;
    private state: ErrorState = {
        errors: new Map(),
        handlers: new Map(),
        retryTimeouts: new Map()
    };

    private readonly MAX_RETRY_COUNT = 5;
    private readonly BASE_RETRY_DELAY = 2000;
    private readonly MAX_RETRY_DELAY = 32000;

    private constructor() {}

    public static getInstance(): ErrorHandler {
        if (!this.instance) {
            this.instance = new ErrorHandler();
        }
        return this.instance;
    }

    public handleError(errorOrType: ErrorType | ErrorDetails, message?: string | Error, context?: any): void {
        let error: ErrorDetails;

        // Create ErrorDetails object from parameters if needed
        if (typeof errorOrType === 'string') {
            error = {
                type: errorOrType,
                message: message instanceof Error ? message.message : message || 'An error occurred',
                timestamp: Date.now(),
                retryCount: 0,
                resolved: false,
                context: context
            };
        } else {
            error = errorOrType;
        }

        console.error('Error occurred:', error);

        // Add the error to the state
        this.state.errors.set(error.type, error);

        // Notify subscribed handlers
        this.notifyHandlers(error);

        // Log the error to an external service like Sentry
        this.logError(error);

        // Retry logic
        if (error.retryCount < this.MAX_RETRY_COUNT) {
            this.scheduleRetry(error);
        }
    }

    private notifyHandlers(error: ErrorDetails): void {
        const handlers = this.state.handlers.get(error.type);
        if (handlers) {
            handlers.forEach((handler) => handler(error));
        }
    }

    public subscribeToError(type: ErrorType, handler: (error: ErrorDetails) => void): void {
        if (!this.state.handlers.has(type)) {
            this.state.handlers.set(type, new Set());
        }
        this.state.handlers.get(type)?.add(handler);
    }

    public unsubscribeFromError(type: ErrorType, handler: (error: ErrorDetails) => void): void {
        this.state.handlers.get(type)?.delete(handler);
    }

    private getRetryDelay(attempt: number): number {
        const delay = Math.min(
            this.BASE_RETRY_DELAY * Math.pow(2, attempt),
            this.MAX_RETRY_DELAY
        );
        return delay + Math.random() * 500; // Adding jitter
    }

    private scheduleRetry(error: ErrorDetails): void {
        const retryDelay = this.getRetryDelay(error.retryCount);
        const timeout = setTimeout(() => {
            error.retryCount++;
            error.lastRetryTimestamp = Date.now();
            this.handleError(error);
        }, retryDelay);

        this.state.retryTimeouts.set(error.type, timeout);
    }

    private logError(error: ErrorDetails): void {
        // Example integration with Sentry
        console.log('Logging error to external service (e.g., Sentry)...', {
            type: error.type,
            message: error.message,
            context: error.context,
            retryCount: error.retryCount
        });
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
        clearError: () => setError(null),
    };
}

// Create and export a singleton instance
export const errorHandler = ErrorHandler.getInstance();