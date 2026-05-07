/**
 * Multi-Level Caching System Types
 * Phase 95-02: Multi-Level Caching
 *
 * Defines interfaces for the 4-tier caching system:
 * L1: Memory LRU (~100MB)
 * L2: Redis (~2GB)
 * L3: PostgreSQL (compressed)
 * L4: Cloudflare R2 (archive)
 */

import type { ScrapeTier } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Cache Level Types
// =============================================================================

/** Cache level identifier */
export type CacheLevel = "L1" | "L2" | "L3" | "L4";

/** Content type for TTL determination */
export type ContentType =
  | "corporate"
  | "blog_post"
  | "product"
  | "category"
  | "homepage"
  | "dynamic"
  | "generic";

/** Compression algorithm */
export type CompressionAlgo = "lz4" | "zstd" | "none";

// =============================================================================
// Cached Page Types
// =============================================================================

/**
 * Pre-parsed page metadata to avoid re-parsing.
 */
export interface ParsedPageData {
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  images: number;
  hasSchema: boolean;
}

/**
 * Cached page data structure.
 */
export interface CachedPage {
  /** HTML content (decompressed) */
  html: string;

  /** Content hash for deduplication (sha256 truncated to 16 chars) */
  contentHash: string;

  /** When this page was fetched */
  fetchedAt: Date;

  /** When this cache entry expires */
  expiresAt: Date;

  /** Tier used to fetch this page */
  tierUsed: ScrapeTier;

  /** HTTP status code */
  statusCode: number;

  /** Page size in bytes (uncompressed) */
  pageSizeBytes: number;

  /** ETag for conditional GET */
  etag?: string;

  /** Last-Modified header for conditional GET */
  lastModified?: string;

  /** Pre-parsed metadata (if available) */
  parsedData?: ParsedPageData;

  /** Detected content type */
  contentType?: ContentType;
}

// =============================================================================
// Cache Result Types
// =============================================================================

/**
 * Result of a cache lookup.
 */
export interface CacheResult {
  /** Whether the cache lookup succeeded */
  hit: boolean;

  /** Cache level that satisfied the request (if hit) */
  level?: CacheLevel;

  /** Cached data (if hit) */
  data?: CachedPage;

  /** Lookup latency in milliseconds */
  latencyMs: number;
}

/**
 * Revalidation headers for conditional GET.
 */
export interface RevalidationHeaders {
  etag?: string;
  lastModified?: string;
}

// =============================================================================
// Cache Statistics Types
// =============================================================================

/**
 * Per-level cache statistics.
 */
export interface LevelStats {
  hits: number;
  misses: number;
  hitRate: number;
  avgLatencyMs: number;
  sizeBytes?: number;
  itemCount?: number;
}

/**
 * Aggregate cache statistics.
 */
export interface CacheStats {
  l1: LevelStats;
  l2: LevelStats;
  l3: LevelStats;
  l4: LevelStats;

  /** Overall hit rate (any level) */
  totalHitRate: number;

  /** Average latency across all levels */
  avgLatencyMs: number;

  /** Total requests processed */
  totalRequests: number;

  /** Timestamp of last stats reset */
  lastResetAt: Date;
}

// =============================================================================
// Cache Configuration Types
// =============================================================================

/**
 * L1 Memory cache configuration.
 */
export interface L1CacheConfig {
  /** Maximum size in bytes (default: 100MB) */
  maxSizeBytes: number;

  /** Maximum number of items (default: 2000) */
  maxItems: number;

  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtlMs: number;

  /** Whether to update age on get (default: true) */
  updateAgeOnGet: boolean;
}

/**
 * L2 Redis cache configuration.
 */
export interface L2CacheConfig {
  /** Maximum memory allocation (e.g., "2gb") */
  maxMemory: string;

  /** Whether to enable compression (default: true) */
  compressionEnabled: boolean;

  /** Compression algorithm (default: 'lz4') */
  compressionAlgo: CompressionAlgo;

  /** Key prefix (default: 'cache:') */
  keyPrefix: string;
}

/**
 * L3 PostgreSQL cache configuration.
 */
export interface L3CacheConfig {
  /** Retention period in days (default: 30) */
  retentionDays: number;

  /** Compression algorithm (default: 'lz4') */
  compressionAlgo: CompressionAlgo;

  /** Batch size for bulk operations (default: 100) */
  batchSize: number;
}

/**
 * L4 R2 archive configuration.
 */
export interface L4CacheConfig {
  /** R2 bucket name */
  bucket: string;

  /** Retention period in days (default: 90) */
  retentionDays: number;

  /** Compression algorithm (default: 'zstd') */
  compressionAlgo: CompressionAlgo;

  /** Cloudflare account ID */
  accountId: string;
}

/**
 * Full cache configuration.
 */
export interface CacheConfig {
  l1: L1CacheConfig;
  l2: L2CacheConfig;
  l3: L3CacheConfig;
  l4: L4CacheConfig;
}

// =============================================================================
// Cache Operation Types
// =============================================================================

/**
 * Options for cache get operations.
 */
export interface GetOptions {
  /** Maximum cache level to check (default: 'L4') */
  maxLevel?: CacheLevel;

  /** Whether to include parsed data (default: false) */
  includeParsedData?: boolean;

  /** Whether to accept stale (expired but not evicted) data (default: false) */
  acceptStale?: boolean;

  /** Skip specific levels */
  skipLevels?: CacheLevel[];
}

/**
 * Options for cache set operations.
 */
export interface SetOptions {
  /** Override auto-detected content type */
  contentType?: ContentType;

  /** Override calculated TTL */
  ttlMs?: number;

  /** Pre-parsed data to store */
  parsedData?: ParsedPageData;

  /** Skip writing to specific levels */
  skipLevels?: CacheLevel[];
}

// =============================================================================
// Invalidation Types
// =============================================================================

/**
 * Invalidation event types.
 */
export type InvalidationEventType =
  | "url_changed"
  | "domain_updated"
  | "audit_started"
  | "force_refresh"
  | "ttl_expired";

/**
 * Invalidation event.
 */
export interface InvalidationEvent {
  type: InvalidationEventType;
  url?: string;
  domain?: string;
  auditId?: string;
  urls?: string[];
  reason?: string;
}

// =============================================================================
// Cache Manager Interface
// =============================================================================

/**
 * Cache manager interface for the multi-level cache.
 */
export interface ICacheManager {
  /**
   * Get cached page, checking all levels in order.
   */
  get(url: string, options?: GetOptions): Promise<CacheResult>;

  /**
   * Store page in all appropriate cache levels.
   */
  set(url: string, page: CachedPage, options?: SetOptions): Promise<void>;

  /**
   * Invalidate URL from all cache levels.
   */
  invalidate(url: string): Promise<void>;

  /**
   * Invalidate all URLs for a domain.
   */
  invalidateDomain(domain: string): Promise<void>;

  /**
   * Pre-warm cache for a list of URLs (bulk load from L3/L4 to L1/L2).
   */
  prewarm(urls: string[]): Promise<void>;

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats;

  /**
   * Reset cache statistics.
   */
  resetStats(): void;

  /**
   * Check if URL should skip cache (forced refresh).
   */
  shouldSkipCache(url: string): Promise<boolean>;

  /**
   * Get ETag/Last-Modified for conditional GET.
   */
  getRevalidationHeaders(url: string): Promise<RevalidationHeaders | null>;

  /**
   * Handle invalidation event.
   */
  handleInvalidation(event: InvalidationEvent): Promise<void>;
}

// =============================================================================
// Individual Cache Level Interfaces
// =============================================================================

/**
 * Interface for individual cache level implementations.
 */
export interface ICacheLevel {
  /** Cache level identifier */
  readonly level: CacheLevel;

  /** Get item from this cache level */
  get(hash: string): Promise<CachedPage | null>;

  /** Set item in this cache level */
  set(hash: string, page: CachedPage, ttlMs: number): Promise<void>;

  /** Delete item from this cache level */
  delete(hash: string): Promise<void>;

  /** Check if item exists */
  has(hash: string): Promise<boolean>;

  /** Get level-specific stats */
  getStats(): LevelStats;

  /** Clear all items (for testing) */
  clear(): Promise<void>;
}

// =============================================================================
// TTL Strategy Types
// =============================================================================

/**
 * TTL multipliers per cache level.
 */
export const TTL_LEVEL_MULTIPLIERS: Record<CacheLevel, number> = {
  L1: 0.1, // L1 TTL = 10% of base
  L2: 0.5, // L2 TTL = 50% of base
  L3: 1.0, // L3 TTL = 100% of base
  L4: 3.0, // L4 TTL = 300% of base (archive retention)
};

/**
 * Base TTL by content type (in milliseconds).
 */
export const TTL_BY_CONTENT_TYPE: Record<ContentType, number> = {
  corporate: 7 * 24 * 60 * 60 * 1000, // 7 days
  blog_post: 24 * 60 * 60 * 1000, // 24 hours
  product: 4 * 60 * 60 * 1000, // 4 hours
  category: 12 * 60 * 60 * 1000, // 12 hours
  homepage: 4 * 60 * 60 * 1000, // 4 hours
  dynamic: 1 * 60 * 60 * 1000, // 1 hour
  generic: 12 * 60 * 60 * 1000, // 12 hours (default)
};

// =============================================================================
// Tracking Parameters to Strip
// =============================================================================

/**
 * URL parameters to strip during normalization.
 */
export const TRACKING_PARAMS = new Set([
  // Google Analytics
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  // Facebook
  "fbclid",
  // Google Ads
  "gclid",
  // Microsoft Ads
  "msclkid",
  // DoubleClick
  "dclid",
  // Generic tracking
  "_ga",
  "_gl",
  "mc_eid",
  "ref",
  "source",
  // Session IDs
  "PHPSESSID",
  "JSESSIONID",
  "sid",
  "session_id",
]);
