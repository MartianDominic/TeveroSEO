import { useInfiniteQuery } from "@tanstack/react-query";
import { getClientsPaginated } from "@/actions/dashboard/get-clients-paginated";
import type { FilterParams } from "@/types/pagination";
// HIGH-STATE-04 FIX: Use centralized query key factory
import { queryKeys } from "@/lib/query-keys";

interface UsePaginatedClientsOptions extends FilterParams {
  workspaceId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  enabled?: boolean;
  /**
   * Maximum number of pages to keep in memory.
   * Older pages are discarded when this limit is exceeded.
   * Helps prevent memory leaks in long-running infinite scroll sessions.
   * @default 20
   */
  maxPages?: number;
}

/**
 * Hook for fetching paginated clients with infinite scroll support.
 * Uses React Query's useInfiniteQuery for cursor-based pagination.
 *
 * Memory management:
 * - Limits pages kept in memory via maxPages option
 * - Uses gcTime (30min) to garbage collect stale data
 * - staleTime (5min) reduces unnecessary refetches
 */
export function usePaginatedClients(options: UsePaginatedClientsOptions) {
  const {
    workspaceId,
    sortBy,
    sortDir,
    limit,
    enabled = true,
    maxPages = 20,
    ...filters
  } = options;

  return useInfiniteQuery({
    // HIGH-STATE-04 FIX: Use centralized query key factory
    queryKey: queryKeys.clients.paginated(workspaceId ?? "", sortBy, sortDir, filters),
    queryFn: async ({ pageParam }) => {
      return getClientsPaginated({
        workspaceId: workspaceId ?? "",
        cursor: pageParam,
        limit,
        sortBy,
        sortDir,
        ...filters,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor ?? undefined,
    enabled,
    // Memory management settings
    staleTime: 5 * 60 * 1000,     // 5 minutes - data considered fresh
    gcTime: 30 * 60 * 1000,       // 30 minutes - garbage collection time
    maxPages,                      // Limit pages kept in memory to prevent unbounded growth
  });
}
