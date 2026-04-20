import { useInfiniteQuery } from "@tanstack/react-query";
import { getClientsPaginated } from "@/actions/dashboard/get-clients-paginated";
import type { FilterParams } from "@/types/pagination";

interface UsePaginatedClientsOptions extends FilterParams {
  workspaceId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching paginated clients with infinite scroll support.
 * Uses React Query's useInfiniteQuery for cursor-based pagination.
 */
export function usePaginatedClients(options: UsePaginatedClientsOptions) {
  const { workspaceId, sortBy, sortDir, limit, enabled = true, ...filters } = options;

  return useInfiniteQuery({
    queryKey: ["clients", "paginated", workspaceId, sortBy, sortDir, filters],
    queryFn: async ({ pageParam }) => {
      return getClientsPaginated({
        workspaceId,
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
  });
}
