import "server-only";

/**
 * Dashboard Metrics Server API
 * Phase 62-05: Command Center Dashboard Core
 *
 * Server-side API for fetching pre-computed dashboard metrics.
 * Calls the open-seo-main backend which handles metric computation.
 */

import { getOpenSeo } from "@/lib/server-fetch";
import type { DashboardMetricsResponse } from "@/types/dashboard-metrics";

/**
 * Fetch dashboard metrics for a workspace.
 *
 * This function is called from Server Components to provide initial data.
 * The backend (62-04) handles:
 * - Pre-computed metrics retrieval
 * - Stale detection and background refresh
 * - Triggering computation if metrics missing
 *
 * @param workspaceId - The workspace ID to fetch metrics for
 * @returns Dashboard metrics response with pending/stale indicators
 */
export async function getDashboardMetrics(
  workspaceId: string
): Promise<DashboardMetricsResponse> {
  try {
    const response = await getOpenSeo<DashboardMetricsResponse>(
      `/api/command-center/metrics?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        timeout: 5000, // 5 second timeout
        next: {
          revalidate: 60, // Cache for 1 minute
        },
      }
    );

    return response;
  } catch (error) {
    // Log error but return a "pending" response rather than throwing
    // This allows the dashboard to render with loading states
    console.error("[getDashboardMetrics] Failed to fetch metrics:", error);

    return {
      pending: true,
      metrics: null,
    };
  }
}
