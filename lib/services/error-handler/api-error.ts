// lib/services/error-handler/api-error.ts
import { ErrorType, ErrorMessages } from './types';

export class APIError extends Error {
    readonly type = ErrorType.API;
    
    constructor(
        message: string,
        public readonly statusCode: number = 500,
        public readonly shouldExposeMessage: boolean = false,
        public readonly context?: any
    ) {
        super(message);
        this.name = 'APIError';
    }

    toResponse() {
        return {
            error: this.message,
            message: this.shouldExposeMessage ? this.message : undefined,
            statusCode: this.statusCode,
            type: this.type,
            context: process.env.NODE_ENV === 'development' ? this.context : undefined
        };
    }

    static fromError(error: unknown, defaultMessage = ErrorMessages[ErrorType.API]) {
        if (error instanceof APIError) {
            return error;
        }

        const isDev = process.env.NODE_ENV === 'development';

        if (error instanceof Error) {
            return new APIError(
                isDev ? error.message : defaultMessage,
                500,
                isDev,
                { originalError: error }
            );
        }

        return new APIError(defaultMessage);
    }
}

export function handleAPIError(error: unknown) {
    const apiError = APIError.fromError(error);
    return apiError.toResponse();
}

// Utility function to create specific API errors
export function createAPIError(
    statusCode: number,
    message: string,
    shouldExposeMessage = false,
    context?: any
) {
    return new APIError(message, statusCode, shouldExposeMessage, context);
}

// Common API errors
export const APIErrors = {
    NotFound: (resource?: string) => 
        createAPIError(404, `${resource || 'Resource'} not found`, true),
    
    Unauthorized: () => 
        createAPIError(401, 'Unauthorized', true),
    
    Forbidden: () => 
        createAPIError(403, 'Forbidden', true),
    
    BadRequest: (message: string) => 
        createAPIError(400, message, true),
    
    RateLimit: (retryAfter: number) => 
        createAPIError(429, 'Rate limit exceeded', true, { retryAfter }),
    
    Internal: (error?: Error) => 
        createAPIError(500, 'Internal Server Error', false, { originalError: error })
};