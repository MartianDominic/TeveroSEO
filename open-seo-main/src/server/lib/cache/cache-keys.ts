/**
 * Cache key namespaces and utilities.
 *
 * All Redis cache keys should use these namespaced prefixes to prevent
 * collision between different services sharing the same Redis instance.
 *
 * MED-CACHE-04 FIX: Standardized namespace pattern.
 * Format: {service}:{type}:{id}
 * - service = osm (open-seo-main)
 * - type = functional area (serp, kw, qc, etc.)
 * - id = specific key data (clientId:mappingId:keyword)
 *
 * This standardization enables:
 * - Consistent pattern-based invalidation
 * - Clear ownership of cache entries
 * - Easy debugging and monitoring
 */

/**
 * Cache namespace prefixes.
 * All open-seo-main cache keys should use one of these prefixes.
 */
export const CACHE_NS = {
  /** SERP analysis cache (24h TTL) */
  SERP: "osm:serp:",

  /** Keyword metrics cache (7-day TTL) */
  KEYWORD: "osm:kw:",

  /** Quick check results cache */
  QUICK_CHECK: "osm:qc:",

  /** Quick check share links (30-day TTL) */
  QUICK_CHECK_SHARE: "osm:qc-share:",

  /** Competitor spy results (24h TTL) */
  COMPETITOR_SPY: "osm:competitor:",

  /** Rate limiting counters */
  RATE_LIMIT: "osm:rl:",

  /** Classification singleflight keys */
  CLASSIFICATION: "osm:classify:",

  /** Embedding cache */
  EMBEDDING: "osm:embed:",

  /** BullMQ queue keys (managed by BullMQ, prefix for reference) */
  BULLMQ: "bull:",
} as const;

/**
 * Type-safe cache key type
 */
export type CacheNamespace = (typeof CACHE_NS)[keyof typeof CACHE_NS];

/**
 * Build a cache key with proper namespace.
 *
 * @param namespace - One of CACHE_NS values
 * @param parts - Key components to join with ':'
 * @returns Fully qualified cache key
 *
 * @example
 * buildCacheKey(CACHE_NS.SERP, clientId, mappingId, keyword)
 * // Returns: "osm:serp:client123:mapping456:seo keywords"
 */
export function buildCacheKey(namespace: CacheNamespace, ...parts: string[]): string {
  return `${namespace}${parts.join(":")}`;
}

/**
 * Safe JSON parse with error handling.
 * Returns null for corrupted/invalid JSON instead of throwing.
 *
 * @param json - JSON string to parse
 * @param context - Optional context for logging (e.g., cache key)
 * @returns Parsed value or null on error
 *
 * @example
 * const data = safeJsonParse<SerpAnalysisData>(cached, `serp:${key}`);
 * if (!data) return null; // Treat corrupted cache as cache miss
 */
export function safeJsonParse<T>(json: string, context?: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[cache] Failed to parse JSON${context ? ` for ${context}` : ""}: ${errorMsg}`);
    return null;
  }
}

/**
 * Parse cached JSON with type validation.
 * Returns null if parsing fails or if the result doesn't pass validation.
 *
 * @param json - JSON string to parse
 * @param validator - Function to validate the parsed data
 * @param context - Optional context for logging
 * @returns Validated parsed value or null
 *
 * @example
 * const data = safeJsonParseWithValidation<CachedMetrics>(
 *   cached,
 *   (d) => typeof d.searchVolume === 'number',
 *   'keyword-metrics'
 * );
 */
export function safeJsonParseWithValidation<T>(
  json: string,
  validator: (data: unknown) => data is T,
  context?: string
): T | null {
  const parsed = safeJsonParse<unknown>(json, context);
  if (parsed === null) return null;

  if (!validator(parsed)) {
    console.warn(`[cache] Validation failed${context ? ` for ${context}` : ""}`);
    return null;
  }

  return parsed;
}

// ============================================================================
// MED-CACHE-04: Standardized Key Builders
// ============================================================================

/**
 * Build a client-scoped cache key with standardized format.
 * Format: osm:{type}:{clientId}:{...parts}
 *
 * @param type - Cache type (from CACHE_NS values, without osm: prefix)
 * @param clientId - Client ID for tenant isolation
 * @param parts - Additional key components
 *
 * @example
 * buildClientCacheKey('serp', 'client-123', 'mapping-456', 'keyword')
 * // Returns: "osm:serp:client-123:mapping-456:keyword"
 */
export function buildClientCacheKey(
  type: "serp" | "kw" | "qc" | "competitor" | "embed",
  clientId: string,
  ...parts: string[]
): string {
  return `osm:${type}:${clientId}:${parts.join(":")}`;
}

/**
 * Build a workspace-scoped cache key.
 * Format: osm:{type}:ws:{workspaceId}:{...parts}
 *
 * @param type - Cache type
 * @param workspaceId - Workspace ID
 * @param parts - Additional key components
 */
export function buildWorkspaceCacheKey(
  type: string,
  workspaceId: string,
  ...parts: string[]
): string {
  return `osm:${type}:ws:${workspaceId}:${parts.join(":")}`;
}

/**
 * Build a pattern for matching client-scoped cache keys.
 * Format: osm:{type}:{clientId}:*
 *
 * @param type - Cache type
 * @param clientId - Client ID
 */
export function buildClientCachePattern(
  type: "serp" | "kw" | "qc" | "competitor" | "embed",
  clientId: string
): string {
  return `osm:${type}:${clientId}:*`;
}

/**
 * Extract clientId from a cache key if it follows the standard format.
 * Returns null if the key doesn't match the expected format.
 *
 * @param key - Cache key to parse
 */
export function extractClientIdFromKey(key: string): string | null {
  // Expected format: osm:{type}:{clientId}:...
  const parts = key.split(":");
  if (parts.length >= 3 && parts[0] === "osm") {
    return parts[2];
  }
  return null;
}
