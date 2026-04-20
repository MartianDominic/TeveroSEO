"use server";

/**
 * Server action for cross-client pattern detection.
 * Phase 25: Team & Intelligence
 *
 * Runs pattern detection on workspace data and caches results.
 * Patterns update slowly (hourly) so we cache aggressively.
 */

import { cacheGet, cacheSet, cacheKeys, cacheTags } from "@/lib/cache";
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
 * Mock data generator for demonstration.
 * In production, this would fetch from the backend API.
 */
function generateMockTrafficData(clientCount: number): ClientTrafficData[] {
  const clients: ClientTrafficData[] = [];
  const baseClicks = [500, 600, 550, 580]; // 4 weeks of data

  for (let i = 0; i < clientCount; i++) {
    const clientId = `client_${i + 1}`;
    const variance = Math.random() * 0.4 - 0.2; // -20% to +20%

    // Some clients get hit by a "drop"
    const hasDropped = i < Math.floor(clientCount * 0.35);
    const dropFactor = hasDropped ? 0.65 + Math.random() * 0.1 : 1;

    const weeklyClicks = baseClicks.map((base) =>
      Math.round(base * (1 + variance) * (1 + Math.random() * 0.1))
    );

    const currentWeek = Math.round(weeklyClicks[3] * dropFactor);
    const previousWeek = weeklyClicks[2];
    const changePercent =
      previousWeek > 0
        ? ((currentWeek - previousWeek) / previousWeek) * 100
        : 0;

    clients.push({
      clientId,
      clientName: `Client ${i + 1}`,
      weeklyClicks: [...weeklyClicks.slice(0, 3), currentWeek],
      currentWeekTotal: currentWeek,
      previousWeekTotal: previousWeek,
      changePercent,
    });
  }

  return clients;
}

/**
 * Mock ranking data generator.
 */
function generateMockRankingData(clientCount: number): ClientRankingData[] {
  const rankings: ClientRankingData[] = [];
  const keywords = ["seo services", "digital marketing", "web design"];

  for (let i = 0; i < clientCount; i++) {
    for (const keyword of keywords) {
      const prevPos = Math.floor(Math.random() * 20) + 1;
      // Some clients get hit by same keyword shift
      const hasShift = i < Math.floor(clientCount * 0.4) && keyword === "seo services";
      const posChange = hasShift
        ? Math.floor(Math.random() * 10) - 15 // Drop 5-15 positions
        : Math.floor(Math.random() * 6) - 3; // -3 to +3

      rankings.push({
        clientId: `client_${i + 1}`,
        clientName: `Client ${i + 1}`,
        keyword,
        currentPosition: Math.max(1, prevPos - posChange),
        previousPosition: prevPos,
        positionChange: posChange,
      });
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
    // TODO: Replace with actual API call to fetch client data
    // const trafficData = await getOpenSeo<ClientTrafficData[]>(
    //   `/api/workspaces/${workspaceId}/traffic-data`
    // );
    // const rankingData = await getOpenSeo<ClientRankingData[]>(
    //   `/api/workspaces/${workspaceId}/ranking-data`
    // );

    // Using mock data for now
    const clientCount = 10;
    const trafficData = generateMockTrafficData(clientCount);
    const rankingData = generateMockRankingData(clientCount);

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
 * In production, this would update the database.
 */
export async function dismissPattern(patternId: string): Promise<void> {
  // TODO: Implement with database update
  // await patchOpenSeo(`/api/patterns/${patternId}`, { status: "dismissed" });
  console.log(`[dismiss-pattern] Dismissed pattern: ${patternId}`);
}

/**
 * Resolve a pattern (mark as resolved).
 * In production, this would update the database.
 */
export async function resolvePattern(patternId: string): Promise<void> {
  // TODO: Implement with database update
  // await patchOpenSeo(`/api/patterns/${patternId}`, {
  //   status: "resolved",
  //   resolvedAt: new Date().toISOString(),
  // });
  console.log(`[resolve-pattern] Resolved pattern: ${patternId}`);
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
