// lib/services/error-handler/index.ts
export * from './types';  // Export everything from types
import { ErrorType, ErrorDetails, ErrorState, ErrorMessages, AppError } from './types';
import { getErrorTypeAndMessage } from './utils';

class ErrorHandler {
    private static instance: ErrorHandler;
    private state: ErrorState = {
        errors: new Map(),
        handlers: new Map(),
        retryTimeouts: new Map()
    };

    private readonly MAX_RETRY_COUNT = 3;
    private readonly BASE_RETRY_DELAY = 5000;

    private constructor() {
        Object.values(ErrorType).forEach(type => {
            this.state.handlers.set(type, new Set());
        });
    }

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    addHandler(type: ErrorType, handler: (error: ErrorDetails) => void) {
        const handlers = this.state.handlers.get(type) || new Set();
        handlers.add(handler);
        this.state.handlers.set(type, handlers);
    }

    removeHandler(type: ErrorType, handler: (error: ErrorDetails) => void) {
        const handlers = this.state.handlers.get(type);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.state.handlers.delete(type);
            }
        }
    }



    private notifyHandlers(type: ErrorType, details: ErrorDetails) {
        const handlers = this.state.handlers.get(type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(details);
                } catch (error) {
                    console.error('Error in error handler:', error);
                }
            });
        }
    }

    private handleRetry(type: ErrorType, details: ErrorDetails) {
        const existingTimeout = this.state.retryTimeouts.get(type);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        if (details.retryCount && details.retryCount >= this.MAX_RETRY_COUNT) {
            console.log(`Max retries (${this.MAX_RETRY_COUNT}) reached for ${type}`);
            return;
        }

        const retryDelay = details.retryAfter 
            ? details.retryAfter * 1000 
            : this.BASE_RETRY_DELAY * Math.pow(2, details.retryCount || 0);

        const timeout = setTimeout(() => {
            this.state.retryTimeouts.delete(type);
            this.notifyHandlers(type, { ...details, resolved: true });
        }, retryDelay);

        this.state.retryTimeouts.set(type, timeout);
        console.log(`Scheduled retry for ${type} in ${retryDelay}ms (attempt ${details.retryCount})`);
    }


    handleError(error: unknown, context?: any) {
        const { type, message } = getErrorTypeAndMessage(error);
        const existingError = this.state.errors.get(type);

        const details: ErrorDetails = {
            type,
            message,
            code: type,
            timestamp: Date.now(),
            context,
            retryCount: existingError ? (existingError.retryCount || 0) + 1 : 0,
            resolved: false,
            originalError: error
        };

        // Handle rate limits
        if (type === ErrorType.RATE_LIMIT && context?.retryAfter) {
            details.retryAfter = context.retryAfter;
        }

        this.state.errors.set(type, details);
        this.notifyHandlers(type, details);
        this.handleRetry(type, details);

        return details;
    }

    createError(type: ErrorType, context?: any): AppError {
        return new AppError(type, context);
    }

    // ... rest of the ErrorHandler class implementation ...
    // (keeping the retry, subscription, and other utility methods from before)
}

export const errorHandler = ErrorHandler.getInstance();