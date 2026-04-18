"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

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
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
