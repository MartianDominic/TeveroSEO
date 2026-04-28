"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";

/**
 * Layout for SEO project pages.
 * Provides TanStack Query context for data fetching.
 */
export default function SeoProjectLayout({ children }: { children: ReactNode }) {
  // Create a stable QueryClient per-component instance (not module-level)
  // to support concurrent rendering and avoid shared state between requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,     // 5 minutes - data considered fresh
            gcTime: 30 * 60 * 1000,       // 30 minutes - cache garbage collection (was cacheTime)
            refetchOnWindowFocus: false,  // Don't refetch on tab focus
            retry: 2,
          },
        },
      })
  );

  // Periodic cleanup of stale queries to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const queries = queryClient.getQueryCache().getAll();
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      queries.forEach((query) => {
        // Remove queries not accessed in 1 hour
        const lastAccessed = query.state.dataUpdatedAt;
        if (lastAccessed > 0 && now - lastAccessed > ONE_HOUR) {
          queryClient.removeQueries({ queryKey: query.queryKey });
        }
      });
    }, 5 * 60 * 1000); // Run every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
