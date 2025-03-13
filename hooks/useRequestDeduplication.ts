// hooks/useRequestDeduplication.ts
import { useRef, useCallback } from 'react';

// Track in-flight requests globally
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Hook for deduplicating API requests across components
 */
export function useRequestDeduplication() {
  const cleanupTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Execute a request with deduplication
   * @param key Unique key for the request (e.g., "GET-aircraft-BOEING")
   * @param requestFn Function that returns a promise for the request
   * @param cacheTime How long to keep the request in the deduplication cache (ms)
   */
  const dedupedRequest = useCallback(
    async <T>(
      key: string,
      requestFn: () => Promise<T>,
      cacheTime: number = 2000
    ): Promise<T> => {
      // Check if this request is already in flight
      if (inFlightRequests.has(key)) {
        console.log(`[Dedup] ♻️ Reusing in-flight request: ${key}`);
        return inFlightRequests.get(key) as Promise<T>;
      }

      // Clear any existing cleanup timeout
      if (cleanupTimeoutsRef.current.has(key)) {
        clearTimeout(cleanupTimeoutsRef.current.get(key)!);
        cleanupTimeoutsRef.current.delete(key);
      }

      // Create and store the request promise
      console.log(`[Dedup] 🚀 Starting new request: ${key}`);
      const requestPromise = requestFn();
      inFlightRequests.set(key, requestPromise);

      try {
        // Wait for the request to complete
        const result = await requestPromise;

        // Set a timeout to remove this request from the cache
        const timeoutId = setTimeout(() => {
          console.log(`[Dedup] 🧹 Cleaning up request: ${key}`);
          inFlightRequests.delete(key);
          cleanupTimeoutsRef.current.delete(key);
        }, cacheTime);

        cleanupTimeoutsRef.current.set(key, timeoutId);

        return result;
      } catch (error) {
        // Remove failed requests immediately
        console.log(`[Dedup] ❌ Request failed: ${key}`);
        inFlightRequests.delete(key);
        throw error;
      }
    },
    []
  );

  // Clean up timeouts when the component unmounts
  const cleanup = useCallback(() => {
    cleanupTimeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    cleanupTimeoutsRef.current.clear();
  }, []);

  return { dedupedRequest, cleanup };
}
