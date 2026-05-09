"use server";

/**
 * Server action for cross-client pattern detection.
 * Phase 25: Team & Intelligence
 * Phase 41-02: Updated to use real GSC data endpoints
 *
 * Runs pattern detection on workspace data and caches results.
 * Patterns update slowly (hourly) so we cache aggressively.
 */

import { z } from "zod";

import {
  detectAllPatterns,
  type ClientTrafficData,
  type ClientRankingData,
} from "@/lib/analytics/pattern-detection";
import { requireActionAuth, validateWorkspaceMembership } from "@/lib/auth/action-auth";
import { cacheGet, cacheSet, cacheTags, getCachedWithSingleflight } from "@/lib/cache";
import { cpuIntensiveLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getOpenSeoPattern } from "@/lib/server-fetch";
import { getOpenSeo, patchOpenSeo } from "@/lib/server-fetch";
import type { PatternWithClients, PatternStatus } from "@/types/patterns";

// Cache TTL: 1 hour (patterns don't change rapidly)
const PATTERNS_CACHE_TTL = 3600;

// Validation schemas
const workspaceIdSchema = z.string().uuid("Invalid workspace ID");
const patternIdSchema = z.string().uuid("Invalid pattern ID");

const getPatternsOptionsSchema = z.object({
  status: z.enum(["active", "dismissed", "resolved"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
}).strict();

/**
 * Pagination metadata for list responses.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response wrapper for patterns.
 */
export interface PaginatedPatternsResponse {
  data: PatternWithClients[];
  pagination: PaginationMeta;
}

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
  const auth = await requireActionAuth();

  // Validate workspaceId format
  const validatedWorkspaceId = workspaceIdSchema.safeParse(workspaceId);
  if (!validatedWorkspaceId.success) {
    return [];
  }

  // Validate user has access to this workspace before fetching data
  await validateWorkspaceMembership(validatedWorkspaceId.data, auth);

  // Rate limit: 30 per minute (CPU intensive pattern detection)
  await checkRateLimit(cpuIntensiveLimiter, auth.userId);

  const cacheKey = patternCacheKey(validatedWorkspaceId.data);

  // Use singleflight to prevent cache stampede:
  // Multiple concurrent requests for the same workspace will share
  // a single backend fetch instead of all hitting the API
  return await getCachedWithSingleflight<PatternWithClients[]>(
    cacheKey,
    PATTERNS_CACHE_TTL,
    async () => {
      // Fetch real data from open-seo endpoints
      const [trafficResponse, rankingResponse] = await Promise.all([
        getOpenSeo<TrafficDataResponse[]>(
          `/api/workspaces/${validatedWorkspaceId.data}/traffic-data`
        ),
        getOpenSeo<RankingDataResponse[]>(
          `/api/workspaces/${validatedWorkspaceId.data}/ranking-data`
        ),
      ]);

      // Transform API responses to detection algorithm formats
      const trafficData = transformTrafficData(trafficResponse);
      const rankingData = transformRankingData(rankingResponse);

      // Run detection algorithms
      const patterns = detectAllPatterns(trafficData, rankingData, validatedWorkspaceId.data);

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

      return patternsWithClients;
    },
    cacheGet,
    cacheSet,
    [cacheTags.workspace(validatedWorkspaceId.data)]
  );
  // MEDIUM-ERR-004 FIX: Removed catch block that swallowed errors and returned empty array.
  // Errors now propagate to caller for proper handling. UI should handle errors gracefully.
}

/**
 * Get patterns with optional status filter and pagination.
 */
export async function getPatterns(
  workspaceId: string,
  options: { status?: PatternStatus; page?: number; limit?: number } = {}
): Promise<PaginatedPatternsResponse> {
  // Validate options
  const validatedOptions = getPatternsOptionsSchema.safeParse(options);
  if (!validatedOptions.success) {
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }
  const { status = "active", page = 1, limit = 20 } = validatedOptions.data;

  const patterns = await detectPatterns(workspaceId);

  // Filter by status if specified
  const filtered = status
    ? patterns.filter((p) => p.status === status)
    : patterns;

  // Calculate pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedData = filtered.slice(offset, offset + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Dismiss a pattern (mark as dismissed).
 * Persists status change to database via API.
 */
export async function dismissPattern(patternId: string): Promise<void> {
  const auth = await requireActionAuth();

  // Validate patternId format
  const validated = patternIdSchema.parse(patternId);

  // Fetch pattern to get workspaceId, then validate membership
  const pattern = await getOpenSeoPattern(validated);
  await validateWorkspaceMembership(pattern.workspaceId, auth);

  await patchOpenSeo(`/api/patterns/${validated}`, {
    status: "dismissed",
    dismissedAt: new Date().toISOString(),
  });
}

/**
 * Resolve a pattern (mark as resolved).
 * Persists status change to database via API.
 */
export async function resolvePattern(patternId: string): Promise<void> {
  const auth = await requireActionAuth();

  // Validate patternId format
  const validated = patternIdSchema.parse(patternId);

  // Fetch pattern to get workspaceId, then validate membership
  const pattern = await getOpenSeoPattern(validated);
  await validateWorkspaceMembership(pattern.workspaceId, auth);

  await patchOpenSeo(`/api/patterns/${validated}`, {
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
  const auth = await requireActionAuth();

  // Validate workspaceId format
  const validated = workspaceIdSchema.parse(workspaceId);

  // Validate workspace membership before refreshing
  await validateWorkspaceMembership(validated, auth);

  // Invalidate cache
  const cacheKey = patternCacheKey(validated);
  await cacheSet(cacheKey, null, { ttl: 0 });

  // Re-run detection (will skip validation since we already validated)
  return detectPatterns(validated);
}
