// lib/services/error-handler/hook.ts
import { useEffect, useState } from 'react';
import { ErrorType, type ErrorDetails } from '@/lib/services/error-handler/types';
import { errorHandler } from './index';

interface ErrorState {
    current: ErrorDetails | null;
    history: Map<ErrorType, ErrorDetails>;
}

export function useErrorHandler() {
    const [errorState, setErrorState] = useState<ErrorState>({
        current: null,
        history: new Map()
    });

    useEffect(() => {
        const handleError = (error: ErrorDetails) => {
            setErrorState(prev => ({
                current: error,
                history: new Map(prev.history).set(error.type, error)
            }));
        };

        // Subscribe to all error types using the error handler instance
        const types = Object.values(ErrorType);
        types.forEach(type => {
            errorHandler.addHandler(type, handleError);
        });

        // Cleanup subscriptions
        return () => {
            types.forEach(type => {
                errorHandler.removeHandler(type, handleError);
            });
        };
    }, []);

    const clearError = (type: ErrorType) => {
        setErrorState(prev => {
            const newHistory = new Map(prev.history);
            newHistory.delete(type);
            return {
                current: prev.current?.type === type ? null : prev.current,
                history: newHistory
            };
        });
    };

    return {
        currentError: errorState.current,
        errorHistory: errorState.history,
        clearError,
        hasError: (type: ErrorType) => errorState.history.has(type),
        getError: (type: ErrorType) => errorState.history.get(type)
    };
}