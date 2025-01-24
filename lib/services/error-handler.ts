export enum ErrorType {
    NETWORK = 'NETWORK',
    AUTH = 'AUTH',
    AUTH_REQUIRED = 'AUTH_REQUIRED',
    DATA = 'DATA',
    POLLING = 'POLLING',
    POLLING_TIMEOUT = 'POLLING_TIMEOUT',
    CRITICAL = 'CRITICAL',
    WEBSOCKET = 'WEBSOCKET'
}

interface ErrorDetails {
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

class ErrorHandler {
    private static instance: ErrorHandler;
    private state: ErrorState = {
        errors: new Map(),
        handlers: new Map(),
        retryTimeouts: new Map()
    };

    private readonly MAX_RETRY_COUNT = 5;
    private readonly BASE_RETRY_DELAY = 2000;
    private readonly MAX_RETRY_DELAY = 32000;

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

    handleError(type: ErrorType, error: Error | string, context?: any) {
        const message = error instanceof Error ? error.message : error;
        const existingError = this.state.errors.get(type);
        
        const details: ErrorDetails = {
            type,
            message,
            timestamp: Date.now(),
            context,
            retryCount: existingError ? existingError.retryCount + 1 : 0,
            resolved: false,
            lastRetryTimestamp: Date.now()
        };

        this.logError(details);
        this.state.errors.set(type, details);
        this.notifyHandlers(type, details);

        if (this.shouldRetry(type, details)) {
            this.scheduleRetry(type, details);
        }
    }

    private shouldRetry(type: ErrorType, details: ErrorDetails): boolean {
        if (details.retryCount >= this.MAX_RETRY_COUNT) return false;
        if (type === ErrorType.CRITICAL) return false;
        if (type === ErrorType.AUTH_REQUIRED) return false;

        return true;
    }

    private scheduleRetry(type: ErrorType, details: ErrorDetails) {
        const existingTimeout = this.state.retryTimeouts.get(type);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        const retryDelay = Math.min(
            this.BASE_RETRY_DELAY * Math.pow(2, details.retryCount),
            this.MAX_RETRY_DELAY
        );

        const timeout = setTimeout(() => {
            this.state.retryTimeouts.delete(type);
            this.notifyHandlers(type, { ...details, resolved: true });
        }, retryDelay);

        this.state.retryTimeouts.set(type, timeout);
    }

    private logError(details: ErrorDetails) {
        const logMessage = {
            type: details.type,
            message: details.message,
            retryCount: details.retryCount,
            timestamp: new Date(details.timestamp).toISOString(),
            context: details.context
        };
        
        if (details.type === ErrorType.POLLING || 
            details.type === ErrorType.POLLING_TIMEOUT) {
            console.warn('[Polling Error]', logMessage);
        } else {
            console.error('[Error]', logMessage);
        }
    }

    subscribe(type: ErrorType, handler: (error: ErrorDetails) => void): () => void {
        const handlers = this.state.handlers.get(type);
        if (handlers) {
            handlers.add(handler);
        }
        return () => {
            if (handlers) {
                handlers.delete(handler);
            }
        };
    }

    private notifyHandlers(type: ErrorType, details: ErrorDetails) {
        const handlers = this.state.handlers.get(type);
        handlers?.forEach(handler => {
            try {
                handler(details);
            } catch (error) {
                console.error('Handler execution failed:', error);
            }
        });
    }

    getError(type: ErrorType): ErrorDetails | null {
        return this.state.errors.get(type) || null;
    }

    clearError(type: ErrorType) {
        const timeout = this.state.retryTimeouts.get(type);
        if (timeout) clearTimeout(timeout);
        
        this.state.errors.delete(type);
        this.state.retryTimeouts.delete(type);
    }

    hasActiveError(type: ErrorType): boolean {
        const error = this.state.errors.get(type);
        return !!error && !error.resolved;
    }

    getRetryCount(type: ErrorType): number {
        return this.state.errors.get(type)?.retryCount || 0;
    }
}

export const errorHandler = ErrorHandler.getInstance();