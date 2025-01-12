// lib/services/error-handler/hook.ts
import { useState, useEffect } from 'react';
import { errorHandler } from './index';
import type { ErrorType, ErrorDetails } from './types';

interface ErrorHookResult {
    error: ErrorDetails | null;
    isRetrying: boolean;
    nextRetry: number | null;
    clear: () => void;
}

export function useErrorHandler(type: ErrorType): ErrorHookResult | null {
    const [error, setError] = useState<ErrorDetails | null>(errorHandler.getError(type));
    const [retryStatus, setRetryStatus] = useState(errorHandler.getRetryStatus(type));

    useEffect(() => {
        // Subscribe to error updates
        const unsubscribe = errorHandler.subscribe(type, (newError) => {
            setError(newError);
            setRetryStatus(errorHandler.getRetryStatus(type));
        });

        return unsubscribe;
    }, [type]);

    if (typeof window === 'undefined') return null;

    return {
        error,
        isRetrying: retryStatus.retrying,
        nextRetry: retryStatus.nextRetry,
        clear: () => errorHandler.clearError(type)
    };
}