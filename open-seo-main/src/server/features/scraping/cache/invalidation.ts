/**
 * Cache Invalidation System
 * Phase 95-02: Multi-Level Caching
 *
 * Handles cache invalidation events:
 * - URL-level invalidation
 * - Domain-level invalidation
 * - Force refresh (skip cache)
 * - Cascade invalidation across levels
 */

import type {
  InvalidationEvent,
  InvalidationEventType,
  CacheLevel,
} from "./types";
import { getCacheKey, normalizeUrl, extractDomain } from "./urlNormalization";

// =============================================================================
// Invalidation Event Factory
// =============================================================================

/**
 * Create a URL changed invalidation event.
 */
export function urlChangedEvent(url: string): InvalidationEvent {
  return {
    type: "url_changed",
    url,
  };
}

/**
 * Create a domain updated invalidation event.
 */
export function domainUpdatedEvent(domain: string): InvalidationEvent {
  return {
    type: "domain_updated",
    domain,
  };
}

/**
 * Create an audit started event (for pre-warming).
 */
export function auditStartedEvent(auditId: string, urls: string[]): InvalidationEvent {
  return {
    type: "audit_started",
    auditId,
    urls,
  };
}

/**
 * Create a force refresh event.
 */
export function forceRefreshEvent(url: string, reason: string): InvalidationEvent {
  return {
    type: "force_refresh",
    url,
    reason,
  };
}

/**
 * Create a TTL expired event.
 */
export function ttlExpiredEvent(url: string): InvalidationEvent {
  return {
    type: "ttl_expired",
    url,
  };
}

// =============================================================================
// Invalidation Strategy
// =============================================================================

/**
 * Determines which cache levels should be invalidated for an event type.
 */
export function getInvalidationLevels(eventType: InvalidationEventType): CacheLevel[] {
  switch (eventType) {
    case "url_changed":
      // Invalidate all active levels (L1-L3), preserve L4 archive
      return ["L1", "L2", "L3"];

    case "domain_updated":
      // Domain-wide change - invalidate hot caches only
      return ["L1", "L2"];

    case "force_refresh":
      // Skip cache flag - affects hot caches
      return ["L1", "L2"];

    case "audit_started":
      // Pre-warming - no invalidation needed
      return [];

    case "ttl_expired":
      // TTL expiration is handled by each level's own mechanism
      return [];

    default:
      return [];
  }
}

/**
 * Determines if an invalidation event should preserve historical data.
 */
export function shouldPreserveHistory(eventType: InvalidationEventType): boolean {
  // L4 archive is always preserved for historical comparisons
  // Only actual data corruption would warrant L4 deletion
  return eventType !== "url_changed";
}

// =============================================================================
// Cascade Invalidation Logic
// =============================================================================

/**
 * Cascade invalidation order: upstream to downstream.
 * When invalidating L3, also invalidate L2 and L1.
 */
export function getCascadeOrder(sourceLevel: CacheLevel): CacheLevel[] {
  switch (sourceLevel) {
    case "L4":
      return ["L3", "L2", "L1"];
    case "L3":
      return ["L2", "L1"];
    case "L2":
      return ["L1"];
    case "L1":
      return [];
    default:
      return [];
  }
}

/**
 * Check if a level should be invalidated based on source level.
 */
export function shouldInvalidateLevel(
  targetLevel: CacheLevel,
  sourceLevel: CacheLevel
): boolean {
  const cascadeOrder = getCascadeOrder(sourceLevel);
  return cascadeOrder.includes(targetLevel);
}

// =============================================================================
// Invalidation Key Generation
// =============================================================================

/**
 * Get cache keys to invalidate for a URL.
 */
export function getInvalidationKeys(url: string): string[] {
  try {
    const normalized = normalizeUrl(url);
    const hash = getCacheKey(normalized);

    // Return all key patterns that might exist for this URL
    return [
      hash, // Base hash for L1/L3/L4
      `html:${hash}`, // HTML content key
      `meta:${hash}`, // Metadata key (L2)
      `etag:${hash}`, // ETag key (L2)
      `skip:${hash}`, // Skip cache flag (L2)
    ];
  } catch {
    return [];
  }
}

/**
 * Get cache key pattern for a domain.
 */
export function getDomainPattern(domain: string): string {
  // For Redis/pattern-based invalidation
  // Note: This is a pattern, not a direct key
  return `*${domain}*`;
}

// =============================================================================
// Conditional GET Helpers
// =============================================================================

/**
 * Check if a 304 Not Modified response should extend cache TTL.
 * Returns true when content is within 20% of expiration (good time to extend).
 */
export function shouldExtendTtlOn304(
  originalExpiresAt: Date,
  now?: Date
): boolean {
  const currentTime = now ?? new Date();
  const timeToExpiry = originalExpiresAt.getTime() - currentTime.getTime();

  // Don't extend if already expired
  if (timeToExpiry <= 0) return false;

  // Approximate threshold: extend if less than 1 hour remaining
  // This is a heuristic since we don't have fetchedAt
  const extensionThreshold = 60 * 60 * 1000; // 1 hour
  return timeToExpiry < extensionThreshold;
}

/**
 * Calculate new expiration time after 304 response.
 */
export function calculateExtendedExpiry(
  originalFetchedAt: Date,
  originalExpiresAt: Date,
  extensionFactor = 0.5
): Date {
  const originalTtl = originalExpiresAt.getTime() - originalFetchedAt.getTime();
  const extension = Math.round(originalTtl * extensionFactor);
  return new Date(Date.now() + extension);
}

// =============================================================================
// Stale-While-Revalidate Pattern
// =============================================================================

/**
 * Configuration for stale-while-revalidate pattern.
 */
export interface StaleWhileRevalidateConfig {
  /** Maximum age (in ms) to serve stale content */
  maxStaleAge: number;
  /** Whether to allow stale content */
  enabled: boolean;
}

const DEFAULT_SWR_CONFIG: StaleWhileRevalidateConfig = {
  maxStaleAge: 60 * 60 * 1000, // 1 hour
  enabled: true,
};

/**
 * Check if stale content should be served while revalidating.
 */
export function shouldServeStale(
  expiresAt: Date,
  fetchedAt: Date,
  config: StaleWhileRevalidateConfig = DEFAULT_SWR_CONFIG
): boolean {
  if (!config.enabled) return false;

  const now = Date.now();
  const expiredAt = expiresAt.getTime();

  // If not expired, don't need stale logic
  if (now < expiredAt) return false;

  // Check if within acceptable stale window
  const staleAge = now - expiredAt;
  return staleAge <= config.maxStaleAge;
}

/**
 * Check if content needs revalidation (expired or nearly expired).
 */
export function needsRevalidation(
  expiresAt: Date,
  threshold = 0.2 // Revalidate when 20% TTL remaining
): boolean {
  const now = Date.now();
  const expiry = expiresAt.getTime();

  if (now >= expiry) return true;

  // Approximate original TTL (we'd need fetchedAt for exact calculation)
  // Assume 12h default if we can't calculate
  const approximateTtl = 12 * 60 * 60 * 1000;
  const timeRemaining = expiry - now;

  return timeRemaining / approximateTtl < threshold;
}

// =============================================================================
// Invalidation Batch Helpers
// =============================================================================

/**
 * Group URLs by domain for efficient batch invalidation.
 */
export function groupUrlsByDomain(urls: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain) continue;

    const existing = grouped.get(domain) ?? [];
    existing.push(url);
    grouped.set(domain, existing);
  }

  return grouped;
}

/**
 * Filter URLs that need invalidation based on content hash comparison.
 */
export function filterChangedUrls(
  urlHashMap: Map<string, string>, // URL -> current content hash
  existingHashes: Map<string, string> // URL -> cached content hash
): string[] {
  const changed: string[] = [];

  for (const [url, currentHash] of urlHashMap) {
    const cachedHash = existingHashes.get(url);
    if (!cachedHash || cachedHash !== currentHash) {
      changed.push(url);
    }
  }

  return changed;
}

// =============================================================================
// Invalidation Logging
// =============================================================================

/**
 * Create a log entry for invalidation event.
 */
export function createInvalidationLog(
  event: InvalidationEvent,
  levels: CacheLevel[],
  keysInvalidated: number
): {
  timestamp: Date;
  eventType: InvalidationEventType;
  target: string;
  levels: CacheLevel[];
  keysInvalidated: number;
} {
  return {
    timestamp: new Date(),
    eventType: event.type,
    target:
      event.url ??
      event.domain ??
      event.auditId ??
      (event.urls ? `${event.urls.length} URLs` : "unknown"),
    levels,
    keysInvalidated,
  };
}
