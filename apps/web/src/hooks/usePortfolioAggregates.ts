/**
 * Hook for fetching pre-computed portfolio aggregates.
 * Uses server action with caching for instant dashboard stats.
 *
 * Phase 23: Performance & Scale
 */

import { useQuery } from "@tanstack/react-query";
import { getPortfolioAggregates } from "@/actions/dashboard/get-portfolio-aggregates";

export function usePortfolioAggregates(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["portfolio", "aggregates", workspaceId],
    queryFn: () => {
      if (!workspaceId) return null;
      return getPortfolioAggregates(workspaceId);
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes (matches worker schedule)
  });
}
