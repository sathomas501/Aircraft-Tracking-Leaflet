// lib/services/error-handler/types.ts
export enum ErrorType {
    NETWORK = 'NETWORK_ERROR',
    API = 'API_ERROR',
    VALIDATION = 'VALIDATION_ERROR',
    POSITION = 'POSITION_ERROR',
    DATA_LOAD = 'DATA_LOAD_ERROR',
    WEBSOCKET = 'WEBSOCKET_ERROR',
    RATE_LIMIT = 'RATE_LIMIT_ERROR',
    AUTH = 'AUTH_ERROR',
    UNKNOWN = 'UNKNOWN_ERROR'
}

export const ErrorMessages = {
    [ErrorType.NETWORK]: 'Network error occurred. Please check your connection.',
    [ErrorType.API]: 'API request failed. Please try again.',
    [ErrorType.VALIDATION]: 'Please check your input and try again.',
    [ErrorType.POSITION]: 'Failed to update aircraft positions.',
    [ErrorType.DATA_LOAD]: 'Failed to load aircraft data.',
    [ErrorType.WEBSOCKET]: 'WebSocket connection failed.',
    [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait.',
    [ErrorType.AUTH]: 'Authentication failed.',
    [ErrorType.UNKNOWN]: 'An unknown error occurred.'
} as const;

export interface ErrorDetails {
    type: ErrorType;
    message: string;
    code: ErrorType;
    retryAfter?: number;
    timestamp: number;
    context?: any;
    retryCount?: number;
    resolved?: boolean;
    originalError?: unknown;
}

export interface ErrorState {
    errors: Map<ErrorType, ErrorDetails>;
    handlers: Map<ErrorType, Set<(error: ErrorDetails) => void>>;
    retryTimeouts: Map<ErrorType, NodeJS.Timeout>;
}

export class AppError extends Error {
    code: ErrorType;
    context?: any;
    
    constructor(type: ErrorType, context?: any) {
        super(ErrorMessages[type]);
        this.code = type;
        this.context = context;
        this.name = 'AppError';
    }
}