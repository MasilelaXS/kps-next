/**
 * Optimistic UI Hook
 * Provides instant UI feedback while API calls happen in background
 */

import { useState, useCallback } from 'react';

interface OptimisticOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

export function useOptimistic<T = any>() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async <R = T>(
      optimisticUpdate: () => void,
      apiCall: () => Promise<R>,
      options?: OptimisticOptions<R>
    ): Promise<R | null> => {
      try {
        // Apply optimistic update IMMEDIATELY (no waiting)
        optimisticUpdate();
        
        setIsPending(true);
        setError(null);

        // API call happens in background
        const result = await apiCall();
        
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Operation failed');
        setError(error);
        options?.onError?.(error);
        return null;
      } finally {
        setIsPending(false);
        options?.onSettled?.();
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setError(null);
  }, []);

  return {
    execute,
    isPending,
    error,
    reset,
  };
}

/**
 * Debounce hook for search/filter operations
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  });

  return debouncedValue;
}
