"use server";

/**
 * Server action for cross-client pattern detection.
 * Phase 25: Team & Intelligence
 * Phase 41-02: Updated to use real GSC data endpoints
 *
 * Runs pattern detection on workspace data and caches results.
 * Patterns update slowly (hourly) so we cache aggressively.
 */

import { cacheGet, cacheSet, cacheTags } from "@/lib/cache";
import { getOpenSeo, patchOpenSeo } from "@/lib/server-fetch";
import type { PatternWithClients, PatternStatus } from "@/types/patterns";
import {
  detectAllPatterns,
  type ClientTrafficData,
  type ClientRankingData,
} from "@/lib/analytics/pattern-detection";

// Cache TTL: 1 hour (patterns don't change rapidly)
const PATTERNS_CACHE_TTL = 3600;

// Extend cache keys
const patternCacheKey = (workspaceId: string) =>
  `patterns:detected:${workspaceId}`;

/**
 * Response from workspace traffic-data endpoint.
 */
interface TrafficDataResponse {
  clientId: string;
  clientName: string;
  weeklyClicks: number[];
  currentWeekTotal: number;
  previousWeekTotal: number;
  changePercent: number;
  status: "dropped" | "growing" | "stable";
}

/**
 * Response from workspace ranking-data endpoint.
 */
interface RankingDataResponse {
  clientId: string;
  clientName: string;
  topKeywords: Array<{
    keyword: string;
    currentPosition: number | null;
    previousPosition: number | null;
    change: number;
  }>;
  improvedCount: number;
  droppedCount: number;
}

/**
 * Transform API response to ClientTrafficData format.
 */
function transformTrafficData(data: TrafficDataResponse[]): ClientTrafficData[] {
  return data.map((item) => ({
    clientId: item.clientId,
    clientName: item.clientName,
    weeklyClicks: item.weeklyClicks,
    currentWeekTotal: item.currentWeekTotal,
    previousWeekTotal: item.previousWeekTotal,
    changePercent: item.changePercent,
  }));
}

/**
 * Transform API response to ClientRankingData format.
 */
function transformRankingData(data: RankingDataResponse[]): ClientRankingData[] {
  const rankings: ClientRankingData[] = [];

  for (const client of data) {
    for (const kw of client.topKeywords) {
      if (kw.currentPosition !== null && kw.previousPosition !== null) {
        rankings.push({
          clientId: client.clientId,
          clientName: client.clientName,
          keyword: kw.keyword,
          currentPosition: kw.currentPosition,
          previousPosition: kw.previousPosition,
          positionChange: kw.change,
        });
      }
    }
  }

  return rankings;
}

/**
 * Detect patterns across all clients in a workspace.
 * Results are cached for 1 hour.
 */
export async function detectPatterns(
  workspaceId: string
): Promise<PatternWithClients[]> {
  if (!workspaceId) {
    return [];
  }

  // Check cache first
  const cacheKey = patternCacheKey(workspaceId);
  const cached = await cacheGet<PatternWithClients[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch real data from open-seo endpoints
    const [trafficResponse, rankingResponse] = await Promise.all([
      getOpenSeo<TrafficDataResponse[]>(
        `/api/workspaces/${workspaceId}/traffic-data`
      ),
      getOpenSeo<RankingDataResponse[]>(
        `/api/workspaces/${workspaceId}/ranking-data`
      ),
    ]);

    // Transform API responses to detection algorithm formats
    const trafficData = transformTrafficData(trafficResponse);
    const rankingData = transformRankingData(rankingResponse);

    // Run detection algorithms
    const patterns = detectAllPatterns(trafficData, rankingData, workspaceId);

    // Enrich with client names
    const patternsWithClients: PatternWithClients[] = patterns.map((p) => ({
      ...p,
      affectedClients: p.affectedClientIds.map((id) => {
        const traffic = trafficData.find((t) => t.clientId === id);
        return {
          id,
          name: traffic?.clientName ?? `Client ${id}`,
        };
      }),
    }));

    // Cache results
    await cacheSet(cacheKey, patternsWithClients, {
      ttl: PATTERNS_CACHE_TTL,
      tags: [cacheTags.workspace(workspaceId)],
    });

    return patternsWithClients;
  } catch (error) {
    console.error("[detect-patterns] Error detecting patterns:", error);
    return [];
  }
}

/**
 * Get patterns with optional status filter.
 */
export async function getPatterns(
  workspaceId: string,
  options: { status?: PatternStatus; limit?: number } = {}
): Promise<PatternWithClients[]> {
  const { status = "active", limit = 20 } = options;

  const patterns = await detectPatterns(workspaceId);

  // Filter by status if specified
  const filtered = status
    ? patterns.filter((p) => p.status === status)
    : patterns;

  // Apply limit
  return filtered.slice(0, limit);
}

/**
 * Dismiss a pattern (mark as dismissed).
 * Persists status change to database via API.
 */
export async function dismissPattern(patternId: string): Promise<void> {
  if (!patternId) {
    throw new Error("patternId is required");
  }

  await patchOpenSeo(`/api/patterns/${patternId}`, {
    status: "dismissed",
    dismissedAt: new Date().toISOString(),
  });
}

/**
 * Resolve a pattern (mark as resolved).
 * Persists status change to database via API.
 */
export async function resolvePattern(patternId: string): Promise<void> {
  if (!patternId) {
    throw new Error("patternId is required");
  }

  await patchOpenSeo(`/api/patterns/${patternId}`, {
    status: "resolved",
    resolvedAt: new Date().toISOString(),
  });
}

/**
 * Manually trigger pattern detection (bypasses cache).
 */
export async function refreshPatterns(
  workspaceId: string
): Promise<PatternWithClients[]> {
  // Invalidate cache
  const cacheKey = patternCacheKey(workspaceId);
  await cacheSet(cacheKey, null, { ttl: 0 });

  // Re-run detection
  return detectPatterns(workspaceId);
}
