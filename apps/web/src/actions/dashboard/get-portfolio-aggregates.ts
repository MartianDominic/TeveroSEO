"use server";

import { z } from "zod";
import { requireActionAuth, validateWorkspaceMembership } from "@/lib/auth/action-auth";
import { getFastApi } from "@/lib/server-fetch";
import { cacheGet, cacheSet, cacheKeys, cacheTags } from "@/lib/cache";

// Validation schema
const workspaceIdSchema = z.string().uuid("Invalid workspace ID");

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
 * Result type with explicit error handling instead of silent null returns.
 */
export interface PortfolioAggregatesResult {
  data: PortfolioAggregates | null;
  error?: string;
}

/**
 * Fetch pre-computed portfolio aggregates for a workspace.
 * Uses Redis caching with 60s TTL (aggregates update every 5 min).
 *
 * SECURITY: Returns explicit error shape instead of silent null to help
 * callers distinguish between "no data" and "error occurred".
 */
export async function getPortfolioAggregates(
  workspaceId: string
): Promise<PortfolioAggregatesResult> {
  // Validate workspaceId format - throw on invalid input
  const validatedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);
  if (!validatedWorkspaceId.success) {
    return { data: null, error: "Invalid workspace ID format" };
  }

  const auth = await requireActionAuth();

  // Validate workspace membership to prevent IDOR
  await validateWorkspaceMembership(validatedWorkspaceId.data, auth);

  // Check cache first
  const cacheKey = cacheKeys.portfolioAggregates(validatedWorkspaceId.data);
  const cached = await cacheGet<PortfolioAggregates>(cacheKey);
  if (cached) {
    return { data: cached };
  }

  try {
    // Fetch from backend API
    const response = await getFastApi<{ data: PortfolioAggregates | null }>(
      `/api/dashboard/portfolio-aggregates?workspaceId=${encodeURIComponent(validatedWorkspaceId.data)}`
    );

    if (!response.data) {
      // No aggregates computed yet - this is a valid state, not an error
      return { data: null };
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
      tags: [cacheTags.workspace(validatedWorkspaceId.data)],
    });

    return { data: aggregates };
  } catch (error) {
    console.error("[get-portfolio-aggregates] Error fetching aggregates:", error);
    // Return explicit error instead of silent null
    return {
      data: null,
      error: "Failed to load portfolio aggregates. Please try again.",
    };
  }
}
