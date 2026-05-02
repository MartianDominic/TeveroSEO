"use client";

/**
 * useDashboardMetrics Hook
 * Phase 62-05: Command Center Dashboard Core
 *
 * TanStack Query hook for fetching dashboard metrics with:
 * - Server-side initial data support
 * - Automatic 5-minute background refresh
 * - Stale time of 4 minutes to minimize unnecessary refetches
 */

import { useQuery } from "@tanstack/react-query";
import type { DashboardMetricsResponse } from "@/types/dashboard-metrics";

/**
 * Query key factory for dashboard metrics.
 */
export const dashboardKeys = {
  all: ["dashboard"] as const,
  metrics: (workspaceId: string) =>
    [...dashboardKeys.all, "metrics", workspaceId] as const,
};

/**
 * Fetches dashboard metrics from the command center API.
 *
 * @param workspaceId - The workspace ID to fetch metrics for
 * @returns Dashboard metrics response
 */
async function fetchDashboardMetrics(
  workspaceId: string
): Promise<DashboardMetricsResponse> {
  const res = await fetch("/api/command-center/metrics", {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch dashboard metrics");
  }

  return res.json();
}

interface UseDashboardMetricsOptions {
  /** Initial data from server-side fetch */
  initialData?: DashboardMetricsResponse;
}

/**
 * Hook to fetch and manage dashboard metrics state.
 *
 * @param workspaceId - The workspace ID to fetch metrics for
 * @param options - Hook options including initialData
 * @returns Query result with dashboard metrics
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDashboardMetrics(workspaceId, { initialData });
 * const metrics = data?.metrics;
 * ```
 */
export function useDashboardMetrics(
  workspaceId: string,
  options: UseDashboardMetricsOptions = {}
) {
  const { initialData } = options;

  return useQuery<DashboardMetricsResponse>({
    queryKey: dashboardKeys.metrics(workspaceId),
    queryFn: () => fetchDashboardMetrics(workspaceId),
    initialData,
    // Refresh every 5 minutes to match backend computation cycle
    refetchInterval: 5 * 60 * 1000,
    // Consider data stale after 4 minutes
    staleTime: 4 * 60 * 1000,
    // Don't retry on 4xx errors (auth issues)
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("401")) {
        return false;
      }
      return failureCount < 2;
    },
    // Refetch on window focus after 2 minutes of being stale
    refetchOnWindowFocus: true,
  });
}
