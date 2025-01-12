// lib/services/error-handler.ts
export enum ErrorType {
    NETWORK = 'NETWORK',
    AUTH = 'AUTH',
    RATE_LIMIT = 'RATE_LIMIT',
    DATA = 'DATA',
    WEBSOCKET = 'WEBSOCKET'
}

interface ErrorDetails {
    type: ErrorType;
    message: string;
    retryAfter?: number;
    timestamp: number;
    context?: any;
    retryCount?: number;
    resolved?: boolean;
}

interface ErrorState {
    errors: Map<ErrorType, ErrorDetails>;
    handlers: Map<ErrorType, Set<(error: ErrorDetails) => void>>;
    retryTimeouts: Map<ErrorType, NodeJS.Timeout>;
}

class ErrorHandler {
    private static instance: ErrorHandler;
    private state: ErrorState = {
        errors: new Map(),
        handlers: new Map(),
        retryTimeouts: new Map()
    };

    private readonly MAX_RETRY_COUNT = 3;
    private readonly BASE_RETRY_DELAY = 5000; // 5 seconds

    private constructor() {
        // Initialize handlers for each error type
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

    handleError(type: ErrorType, error: Error | string, context?: any) {
        const message = error instanceof Error ? error.message : error;
        const existingError = this.state.errors.get(type);

        const details: ErrorDetails = {
            type,
            message,
            timestamp: Date.now(),
            context,
            retryCount: existingError ? (existingError.retryCount || 0) + 1 : 0,
            resolved: false
        };

        // Special handling for rate limit errors
        if (type === ErrorType.RATE_LIMIT && context?.retryAfter) {
            details.retryAfter = context.retryAfter;
        }

        this.state.errors.set(type, details);

        // Notify all handlers for this error type
        this.notifyHandlers(type, details);

        // Handle automatic retries if applicable
        this.handleRetry(type, details);
    }

    private handleRetry(type: ErrorType, details: ErrorDetails) {
        // Clear any existing retry timeout
        const existingTimeout = this.state.retryTimeouts.get(type);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Don't retry if max retries reached
        if (details.retryCount && details.retryCount >= this.MAX_RETRY_COUNT) {
            console.log(`Max retries (${this.MAX_RETRY_COUNT}) reached for ${type}`);
            return;
        }

        // Calculate retry delay with exponential backoff
        const retryDelay = details.retryAfter 
            ? details.retryAfter * 1000 
            : this.BASE_RETRY_DELAY * Math.pow(2, details.retryCount || 0);

        // Set up retry timeout
        const timeout = setTimeout(() => {
            this.state.retryTimeouts.delete(type);
            this.notifyHandlers(type, { ...details, resolved: true });
        }, retryDelay);

        this.state.retryTimeouts.set(type, timeout);

        console.log(`Scheduled retry for ${type} in ${retryDelay}ms (attempt ${details.retryCount})`);
    }

    subscribe(type: ErrorType, handler: (error: ErrorDetails) => void): () => void {
        const handlers = this.state.handlers.get(type);
        if (handlers) {
            handlers.add(handler);
        }

        // Return unsubscribe function
        return () => {
            if (handlers) {
                handlers.delete(handler);
            }
        };
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

    getError(type: ErrorType): ErrorDetails | null {
        return this.state.errors.get(type) || null;
    }

    clearError(type: ErrorType) {
        this.state.errors.delete(type);
        // Clear any pending retry timeout
        const timeout = this.state.retryTimeouts.get(type);
        if (timeout) {
            clearTimeout(timeout);
            this.state.retryTimeouts.delete(type);
        }
    }

    clearAllErrors() {
        this.state.errors.clear();
        // Clear all retry timeouts
        this.state.retryTimeouts.forEach(timeout => clearTimeout(timeout));
        this.state.retryTimeouts.clear();
    }

    hasActiveError(type: ErrorType): boolean {
        const error = this.state.errors.get(type);
        return !!error && !error.resolved;
    }

    getRetryStatus(type: ErrorType): { retrying: boolean; nextRetry: number | null } {
        const timeout = this.state.retryTimeouts.get(type);
        if (!timeout) {
            return { retrying: false, nextRetry: null };
        }

        const error = this.state.errors.get(type);
        if (!error) {
            return { retrying: false, nextRetry: null };
        }

        const retryAfter = error.retryAfter 
            ? error.retryAfter * 1000 
            : this.BASE_RETRY_DELAY * Math.pow(2, error.retryCount || 0);

        return {
            retrying: true,
            nextRetry: error.timestamp + retryAfter
        };
    }

    // Hook for React components
    useErrorHandler(type: ErrorType) {
        if (typeof window === 'undefined') return null;

        const error = this.getError(type);
        const retryStatus = this.getRetryStatus(type);

        return {
            error,
            isRetrying: retryStatus.retrying,
            nextRetry: retryStatus.nextRetry,
            clear: () => this.clearError(type)
        };
    }
}

export const errorHandler = ErrorHandler.getInstance();