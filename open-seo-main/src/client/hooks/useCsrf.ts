/**
 * CSRF Token Hook
 * React hook for managing CSRF tokens in SPA architecture.
 *
 * Usage:
 * 1. Call useCsrfToken() in your app root or auth provider
 * 2. Use getCsrfHeaders(token) for fetch calls
 * 3. Token is automatically refreshed when stale
 *
 * @example
 * function App() {
 *   const { token, isLoading } = useCsrfToken();
 *
 *   // Use with fetch
 *   const response = await fetch('/api/data', {
 *     method: 'POST',
 *     headers: getCsrfHeaders(token),
 *     body: JSON.stringify(data),
 *   });
 * }
 */
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

/**
 * Response from CSRF token endpoint
 */
interface CsrfResponse {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * CSRF token query key for React Query
 */
export const CSRF_TOKEN_QUERY_KEY = ["csrf-token"] as const;

/**
 * Fetch CSRF token from the server.
 * Includes credentials to ensure cookies are sent/received.
 */
async function fetchCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf-token", {
    method: "GET",
    credentials: "include", // Important: include cookies
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status}`);
  }

  const data: CsrfResponse = await response.json();

  if (!data.success || !data.token) {
    throw new Error(data.error ?? "Failed to get CSRF token");
  }

  return data.token;
}

/**
 * Hook to get and manage CSRF token.
 *
 * Features:
 * - Automatically fetches token on mount
 * - Caches token for 30 minutes
 * - Does not refetch on window focus (tokens are stable)
 * - Provides refresh function for manual refresh
 *
 * @returns Object with token, loading state, error, and refresh function
 *
 * @example
 * const { token, isLoading, error, refresh } = useCsrfToken();
 *
 * if (error) {
 *   console.error('CSRF token error:', error);
 * }
 *
 * // Force refresh if needed
 * await refresh();
 */
export function useCsrfToken() {
  const queryClient = useQueryClient();

  const {
    data: token,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: CSRF_TOKEN_QUERY_KEY,
    queryFn: fetchCsrfToken,
    // Token is stable - 30 minute cache
    staleTime: 1000 * 60 * 30,
    // Keep in cache for 1 hour
    gcTime: 1000 * 60 * 60,
    // Don't refetch on window focus - token is stable
    refetchOnWindowFocus: false,
    // Don't refetch on reconnect - token is stable
    refetchOnReconnect: false,
    // Retry 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const refresh = useCallback(async () => {
    // Invalidate cache and refetch
    await queryClient.invalidateQueries({ queryKey: CSRF_TOKEN_QUERY_KEY });
    const result = await refetch();
    return result.data;
  }, [queryClient, refetch]);

  return {
    token,
    isLoading,
    error: error as Error | null,
    refresh,
  };
}

/**
 * Get headers object with CSRF token.
 * Use this when making fetch calls.
 *
 * @param token - CSRF token from useCsrfToken hook
 * @returns Headers object with X-CSRF-Token if token is available
 *
 * @example
 * const { token } = useCsrfToken();
 *
 * const response = await fetch('/api/data', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     ...getCsrfHeaders(token),
 *   },
 *   body: JSON.stringify(data),
 * });
 */
export function getCsrfHeaders(
  token: string | undefined
): Record<string, string> {
  if (!token) {
    return {};
  }
  return { "X-CSRF-Token": token };
}

/**
 * Create a fetch wrapper that automatically includes CSRF token.
 *
 * @param token - CSRF token from useCsrfToken hook
 * @returns Fetch function with CSRF token included
 *
 * @example
 * const { token } = useCsrfToken();
 * const secureFetch = createSecureFetch(token);
 *
 * const response = await secureFetch('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 */
export function createSecureFetch(
  token: string | undefined
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);

    // Add CSRF token if available and method is state-changing
    const method = init?.method?.toUpperCase() ?? "GET";
    if (token && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.set("X-CSRF-Token", token);
    }

    // Always include credentials for cookie-based auth
    return fetch(input, {
      ...init,
      headers,
      credentials: init?.credentials ?? "include",
    });
  };
}

/**
 * Hook that provides a fetch wrapper with automatic CSRF token injection.
 *
 * @returns Object with secureFetch function and token state
 *
 * @example
 * const { secureFetch, isLoading } = useSecureFetch();
 *
 * if (isLoading) return <Loading />;
 *
 * const response = await secureFetch('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 */
export function useSecureFetch() {
  const { token, isLoading, error, refresh } = useCsrfToken();

  const secureFetch = useMemo(
    () => createSecureFetch(token),
    [token]
  );

  return {
    secureFetch,
    token,
    isLoading,
    error,
    refresh,
  };
}

/**
 * React Query mutation options helper that adds CSRF token.
 *
 * @param token - CSRF token from useCsrfToken hook
 * @param mutationFn - Your mutation function that receives fetch options
 * @returns Mutation function with CSRF token included
 *
 * @example
 * const { token } = useCsrfToken();
 *
 * const createItem = useMutation({
 *   mutationFn: withCsrfMutation(token, async (data: CreateItemInput) => {
 *     const response = await fetch('/api/items', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(data),
 *     });
 *     return response.json();
 *   }),
 * });
 */
export function withCsrfMutation<TData, TVariables>(
  token: string | undefined,
  mutationFn: (
    variables: TVariables,
    csrfHeaders: Record<string, string>
  ) => Promise<TData>
): (variables: TVariables) => Promise<TData> {
  return (variables: TVariables) => {
    const csrfHeaders = getCsrfHeaders(token);
    return mutationFn(variables, csrfHeaders);
  };
}

/**
 * Check if a request needs CSRF protection.
 * Safe methods (GET, HEAD, OPTIONS) don't need CSRF tokens.
 *
 * @param method - HTTP method
 * @returns true if CSRF token is required
 */
export function needsCsrfProtection(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
