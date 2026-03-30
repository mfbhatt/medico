import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface FetchOptions {
  skip?: boolean;
  dependencies?: unknown[];
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export const useFetch = <T = unknown>(
  fetchFn: () => Promise<T>,
  options: FetchOptions = {}
) => {
  const { skip = false, dependencies = [], onSuccess, onError } = options;
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fetchFn();
      setState({ data: result, loading: false, error: null });
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ data: null, loading: false, error });
      onError?.(error);
      throw error;
    }
  }, [fetchFn, onSuccess, onError]);

  useEffect(() => {
    if (skip) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    refetch();
  }, [skip, ...dependencies]);

  return {
    ...state,
    refetch,
  };
};
