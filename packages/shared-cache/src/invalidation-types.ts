/**
 * Unified Cache Invalidation Types
 *
 * Shared type definitions for cross-service cache invalidation.
 * All services (osm, analytics, scraping, apps/web) use these types
 * to communicate via a single Redis pub/sub channel.
 *
 * This unification reduces Redis connections from 8-10 per process
 * to 2 (one publisher, one subscriber).
 *
 * @see CRIT-CACHE-01, HIGH-CACHE-01
 */

/**
 * Cache type identifies which service/domain owns the cache entry.
 * Subscribers filter messages by type to only process relevant invalidations.
 */
export type CacheType =
  | "serp" // SERP analysis cache (open-seo-main)
  | "analytics" // GSC/GA4 analytics cache (open-seo-main)
  | "scraping" // HTML page scraping cache (Phase 95)
  | "app"; // Next.js app cache (apps/web)

/**
 * Unified channel for all cache invalidation messages.
 * Replaces the previous 4 separate channels:
 * - osm:cache:invalidate (SERP)
 * - analytics:cache:invalidate (Analytics)
 * - scraping:cache:invalidate (Phase 95)
 * - tevero:cache:invalidate (apps/web)
 */
export const UNIFIED_INVALIDATION_CHANNEL = "tevero:cache:invalidate";

/**
 * Unified invalidation message format.
 * Includes type field for filtering by service/domain.
 */
export interface UnifiedInvalidationMessage {
  /**
   * Cache type for filtering. Subscribers only process
   * messages matching their registered types.
   */
  type: CacheType;

  /**
   * Exact cache keys to invalidate.
   */
  keys: string[];

  /**
   * Glob patterns to match for invalidation.
   * e.g., "osm:serp:client-123:*" or "*:workspace:uuid:*"
   */
  patterns: string[];

  /**
   * Source instance ID to prevent self-processing.
   * Each process generates a unique ID at startup.
   */
  source: string;

  /**
   * Unix timestamp (ms) when message was published.
   * Used for latency monitoring and debugging.
   */
  timestamp: number;

  /**
   * Optional reason for debugging and logging.
   * e.g., "gsc_sync_complete", "client_deleted", "workspace_transfer"
   */
  reason?: string;

  /**
   * Optional workspace ID for scoped invalidation.
   */
  workspaceId?: string;

  /**
   * Optional site ID for GSC/GA4 analytics invalidation.
   */
  siteId?: string;

  /**
   * Optional analytics cache subtypes to invalidate.
   * Only used when type is "analytics".
   */
  analyticsCacheTypes?: string[];
}

/**
 * Generate a unique instance ID for this process.
 * Used to prevent processing our own invalidation messages.
 */
export function generateInstanceId(prefix: string): string {
  const pid = process.pid;
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${pid}-${random}`;
}

/**
 * Check if a cache key matches a glob pattern.
 * Supports * (any chars) and ? (single char) wildcards.
 */
export function matchesPattern(key: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
    .replace(/\*/g, ".*") // * -> .*
    .replace(/\?/g, "."); // ? -> .

  return new RegExp(`^${regexPattern}$`).test(key);
}

/**
 * Handler function type for processing invalidation messages.
 * Returns number of entries cleared.
 */
export type InvalidationHandler = (
  message: UnifiedInvalidationMessage
) => number | Promise<number>;
