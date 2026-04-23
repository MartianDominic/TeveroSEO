/**
 * SERP cache service with Redis TTL.
 * Caches SERP analysis results to reduce DataForSEO API costs.
 * Phase 36: Content Brief Generation
 */

import { redis } from "@/server/lib/redis";
import type { SerpAnalysisData } from "@/db/brief-schema";

// 24 hours in seconds
export const SERP_CACHE_TTL = 24 * 60 * 60;

/**
 * Build cache key from mappingId and keyword.
 * Format: serp:{mappingId}:{keyword}
 */
export function buildSerpCacheKey(mappingId: string, keyword: string): string {
  return `serp:${mappingId}:${keyword}`;
}

/**
 * Get cached SERP analysis data.
 * Returns null if key does not exist.
 */
export async function getCachedSerp(
  key: string
): Promise<SerpAnalysisData | null> {
  const cached = await redis.get(key);
  if (!cached) {
    return null;
  }
  return JSON.parse(cached) as SerpAnalysisData;
}

/**
 * Cache SERP analysis data with 24h TTL.
 */
export async function setCachedSerp(
  key: string,
  data: SerpAnalysisData
): Promise<void> {
  await redis.setex(key, SERP_CACHE_TTL, JSON.stringify(data));
}

/**
 * Invalidate cached SERP data.
 * Call when keyword is updated in mapping table.
 */
export async function invalidateSerpCache(key: string): Promise<void> {
  await redis.del(key);
}
