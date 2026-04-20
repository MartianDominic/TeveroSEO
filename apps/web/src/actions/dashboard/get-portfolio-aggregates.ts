"use server";

import { getFastApi } from "@/lib/server-fetch";
import { cacheGet, cacheSet, cacheKeys, cacheTags } from "@/lib/cache";

/**
 * Portfolio aggregate data from pre-computed worker results.
 */
export interface PortfolioAggregates {
  id: string;
  workspaceId: string;
  totalClients: number;
  clientsOnTrack: number;
  clientsWatching: number;
  clientsCritical: number;
  clientsNoGoals: number;
  totalGoals: number;
  goalsMet: number;
  avgGoalAttainment: number;
  avgGoalAttainmentTrend: number | null;
  totalClicks30d: number;
  totalImpressions30d: number;
  avgCtr: number;
  totalClicksTrend: number | null;
  totalKeywordsTracked: number;
  keywordsTop10: number;
  keywordsTop3: number;
  keywordsPosition1: number;
  keywordsTop10Trend: number;
  alertsCriticalTotal: number;
  alertsWarningTotal: number;
  clientsWithCriticalAlerts: number;
  unassignedClients: number;
  avgDaysSinceTouch: number | null;
  clientsNeglected: number;
  computedAt: string;
  computationDurationMs: number | null;
}

/**
 * Fetch pre-computed portfolio aggregates for a workspace.
 * Uses Redis caching with 60s TTL (aggregates update every 5 min).
 */
export async function getPortfolioAggregates(
  workspaceId: string
): Promise<PortfolioAggregates | null> {
  if (!workspaceId) return null;

  // Check cache first
  const cacheKey = cacheKeys.portfolioAggregates(workspaceId);
  const cached = await cacheGet<PortfolioAggregates>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch from backend API
    const response = await getFastApi<{ data: PortfolioAggregates | null }>(
      `/api/dashboard/portfolio-aggregates?workspaceId=${encodeURIComponent(workspaceId)}`
    );

    if (!response.data) {
      return null;
    }

    // Parse numeric fields from strings
    const aggregates: PortfolioAggregates = {
      ...response.data,
      avgGoalAttainment: Number(response.data.avgGoalAttainment ?? 0),
      avgGoalAttainmentTrend: response.data.avgGoalAttainmentTrend
        ? Number(response.data.avgGoalAttainmentTrend)
        : null,
      avgCtr: Number(response.data.avgCtr ?? 0),
      totalClicksTrend: response.data.totalClicksTrend
        ? Number(response.data.totalClicksTrend)
        : null,
      avgDaysSinceTouch: response.data.avgDaysSinceTouch
        ? Number(response.data.avgDaysSinceTouch)
        : null,
    };

    // Cache for 60 seconds with workspace tag
    await cacheSet(cacheKey, aggregates, {
      ttl: 60,
      tags: [cacheTags.workspace(workspaceId)],
    });

    return aggregates;
  } catch (error) {
    console.error("[get-portfolio-aggregates] Error fetching aggregates:", error);
    return null;
  }
}
