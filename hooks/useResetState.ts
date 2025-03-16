// useResetState.ts
import { useCallback, useState } from 'react';

interface ResetOptions {
  resetLocalState?: () => void;
  resetParentState?: () => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useResetState = ({
  resetLocalState,
  resetParentState,
  onSuccess,
  onError,
}: ResetOptions) => {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = useCallback(async () => {
    try {
      setIsResetting(true);
      console.log('[ResetHook] Resetting component state...');

      // First reset local component state
      if (resetLocalState) {
        resetLocalState();
      }

      // Then propagate reset to parent components
      if (resetParentState) {
        await resetParentState();
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('[ResetHook] Reset operation failed:', error);
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error('Unknown error during reset')
        );
      }
    } finally {
      setIsResetting(false);
    }
  }, [resetLocalState, resetParentState, onSuccess, onError]);

  return { handleReset, isResetting };
};
