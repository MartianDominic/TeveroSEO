/**
 * CacheManager - Multi-Level Cache Orchestration
 * Phase 95-02: Multi-Level Caching
 * Phase 96: Cross-Instance Cache Invalidation (CACHE-01)
 *
 * Orchestrates the 4-tier caching system:
 * L1: Memory LRU (~100MB) - Sub-millisecond access
 * L2: Redis (~2GB) - Cross-worker sharing
 * L3: PostgreSQL (compressed) - Persistent storage
 * L4: Cloudflare R2 (archive) - Long-term archive
 *
 * Cross-instance coordination:
 * - Uses Redis pub/sub to coordinate L1 invalidation across instances
 * - When one instance invalidates a domain, all instances clear their L1 caches
 */

import type { Redis } from "ioredis";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { L1Cache, createL1Cache } from "./L1Cache";
import { L2Cache, createL2Cache } from "./L2Cache";
import { L3Cache, createL3Cache } from "./L3Cache";
import { L4Cache, createL4Cache } from "./L4Cache";
import type {
  CachedPage,
  CacheLevel,
  CacheResult,
  CacheStats,
  CacheConfig,
  GetOptions,
  SetOptions,
  ICacheManager,
  InvalidationEvent,
  RevalidationHeaders,
} from "./types";
import { normalizeUrl, getCacheKey } from "./urlNormalization";
import { shouldProactivelyRefresh, shouldServeStale } from "./index";
import { cacheLogger } from "../logging";
import {
  UNIFIED_INVALIDATION_CHANNEL,
  generateInstanceId,
  type CacheType,
  type UnifiedInvalidationMessage,
} from "@tevero/shared-cache";

// =============================================================================
// Domain Tracking Constants
// =============================================================================

/**
 * Key prefix for domain-to-hash tracking SETs in Redis.
 *
 * Namespace convention for Redis keys in TeveroSEO:
 * - osm:scrape:* - open-seo-main scraping/caching (this module)
 * - serp:* - SERP cache
 * - analytics:* - Analytics cache
 * - tevero:* - apps/web cache
 */
const DOMAIN_TRACKING_PREFIX = "osm:scrape:domain:";

/** TTL for domain tracking SETs (30 days in seconds) */
const DOMAIN_TRACKING_TTL_SECONDS = 30 * 24 * 60 * 60;

// =============================================================================
// Cross-Instance Invalidation Constants (CACHE-01)
// =============================================================================

/** Cache type for this module - handles scraping cache invalidation */
const SCRAPING_CACHE_TYPE: CacheType = "scraping";

/** Invalidation message types (for internal routing within scraping cache) */
type InvalidationMessageType = "domain" | "url" | "all";

/** Unique instance ID for this process */
const INSTANCE_ID = generateInstanceId("scraping");

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  l1: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    maxItems: 2000,
    defaultTtlMs: 5 * 60 * 1000, // 5 minutes
    updateAgeOnGet: true,
  },
  l2: {
    maxMemory: "2gb",
    compressionEnabled: true,
    compressionAlgo: "gzip",
    keyPrefix: "osm:scrape:",
  },
  l3: {
    retentionDays: 30,
    compressionAlgo: "gzip",
    batchSize: 100,
  },
  l4: {
    bucket: process.env.R2_BUCKET ?? "scrape-archive",
    retentionDays: 90,
    compressionAlgo: "gzip",
    accountId: process.env.CF_ACCOUNT_ID ?? "",
  },
};

// =============================================================================
// CacheManager Implementation
// =============================================================================

/**
 * CacheManager orchestrates multi-level caching for HTML content.
 *
 * Implements the following patterns:
 * - Cache-aside: Check cache first, fetch on miss
 * - Level promotion: Promote L4 hits to L1/L2/L3 for faster subsequent access
 * - TTL propagation: Content-type based TTL with level multipliers
 * - Cascade invalidation: Upstream invalidation on cache eviction
 * - Tenant isolation: L3 operations scoped to clientId via per-client cache instances (Phase 97)
 */
export class CacheManager implements ICacheManager {
  private l1: L1Cache;
  private l2: L2Cache;
  private l3Caches: Map<string, L3Cache> = new Map();
  private l4: L4Cache;
  private redis: Redis;
  private db: PostgresJsDatabase;
  private config: CacheConfig;

  // Aggregate stats
  private totalRequests = 0;
  private totalLatencyMs = 0;
  private lastResetAt = new Date();

  // Cross-instance invalidation (CACHE-01)
  private subscriber: Redis | null = null;
  private isSubscribed = false;
  private invalidationEventsReceived = 0;
  private invalidationEventsPublished = 0;

  // Stale-while-revalidate tracking
  private pendingRefreshes = new Set<string>();
  private backgroundRefreshCount = 0;
  private backgroundRefreshFailures = 0;

  /**
   * Create a new CacheManager instance.
   * @param deps.redis - Redis connection
   * @param deps.db - PostgreSQL database connection
   * @param deps.config - Optional cache configuration
   */
  constructor(deps: {
    redis: Redis;
    db: PostgresJsDatabase;
    config?: Partial<CacheConfig>;
  }) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...deps.config,
      l1: { ...DEFAULT_CONFIG.l1, ...deps.config?.l1 },
      l2: { ...DEFAULT_CONFIG.l2, ...deps.config?.l2 },
      l3: { ...DEFAULT_CONFIG.l3, ...deps.config?.l3 },
      l4: { ...DEFAULT_CONFIG.l4, ...deps.config?.l4 },
    };

    this.redis = deps.redis;
    this.db = deps.db;
    this.l1 = createL1Cache(this.config.l1);
    this.l2 = createL2Cache(deps.redis, this.config.l2);
    // L3 caches are created per-client lazily via getL3Cache()
    this.l4 = createL4Cache(this.config.l4);

    // Initialize cross-instance invalidation subscription
    this.initializeInvalidationSubscription();
  }

  /**
   * Get or create L3 cache for a specific client.
   * Phase 97: Tenant isolation - each client has its own L3 cache instance.
   */
  private getL3Cache(clientId: string): L3Cache {
    let cache = this.l3Caches.get(clientId);
    if (!cache) {
      cache = createL3Cache(this.db, clientId, this.config.l3);
      this.l3Caches.set(clientId, cache);
      cacheLogger.debug({ clientId }, "Created new L3 cache instance for client");
    }
    return cache;
  }

  // ===========================================================================
  // ICacheManager Implementation
  // ===========================================================================

  async get(url: string, options: GetOptions = {}): Promise<CacheResult> {
    const startTime = performance.now();
    this.totalRequests++;

    const hash = getCacheKey(normalizeUrl(url));
    const maxLevel = options.maxLevel ?? "L4";
    const skipLevels = new Set(options.skipLevels ?? []);

    // Check if we should skip cache entirely
    if (!skipLevels.has("L2") && (await this.shouldSkipCache(url))) {
      return this.miss(startTime);
    }

    // L1: Memory (fastest)
    if (!skipLevels.has("L1")) {
      const l1Result = await this.l1.get(hash);
      if (l1Result && this.isValid(l1Result, options.acceptStale)) {
        // Stale-while-revalidate: trigger background refresh if needed
        if (options.acceptStale && this.shouldTriggerBackgroundRefresh(l1Result)) {
          this.triggerBackgroundRefresh(url, hash).catch(err =>
            cacheLogger.error({ url, error: err instanceof Error ? err.message : String(err) }, "Background refresh failed")
          );
        }
        return this.hit("L1", l1Result, startTime);
      }
    }
    if (maxLevel === "L1") return this.miss(startTime);

    // L2: Redis
    if (!skipLevels.has("L2")) {
      const l2Result = await this.l2.get(hash);
      if (l2Result && this.isValid(l2Result, options.acceptStale)) {
        // Promote to L1
        await this.promoteToL1(hash, l2Result);
        // Stale-while-revalidate: trigger background refresh if needed
        if (options.acceptStale && this.shouldTriggerBackgroundRefresh(l2Result)) {
          this.triggerBackgroundRefresh(url, hash).catch(err =>
            cacheLogger.error({ url, error: err instanceof Error ? err.message : String(err) }, "Background refresh failed")
          );
        }
        return this.hit("L2", l2Result, startTime);
      }
    }
    if (maxLevel === "L2") return this.miss(startTime);

    // L3: PostgreSQL (requires clientId for tenant isolation)
    if (!skipLevels.has("L3") && options.clientId) {
      const l3Cache = this.getL3Cache(options.clientId);
      const l3Result = await l3Cache.get(hash);
      if (l3Result && this.isValid(l3Result, options.acceptStale)) {
        // Promote to L1 and L2
        await Promise.all([
          this.promoteToL1(hash, l3Result),
          this.promoteToL2(hash, l3Result),
        ]);
        // Stale-while-revalidate: trigger background refresh if needed
        if (options.acceptStale && this.shouldTriggerBackgroundRefresh(l3Result)) {
          this.triggerBackgroundRefresh(url, hash).catch(err =>
            cacheLogger.error({ url, error: err instanceof Error ? err.message : String(err) }, "Background refresh failed")
          );
        }
        return this.hit("L3", l3Result, startTime);
      }
    } else if (!skipLevels.has("L3") && !options.clientId) {
      cacheLogger.warn({ url }, "L3 cache skipped: clientId not provided for tenant isolation");
    }
    if (maxLevel === "L3") return this.miss(startTime);

    // L4: R2 Archive
    if (!skipLevels.has("L4")) {
      const l4Result = await this.l4.get(hash);
      if (l4Result) {
        // Promote to all levels (L3 requires clientId for tenant isolation)
        await Promise.all([
          this.promoteToL1(hash, l4Result),
          this.promoteToL2(hash, l4Result),
          this.promoteToL3(hash, url, l4Result, options.clientId),
        ]);
        // Stale-while-revalidate: trigger background refresh if needed
        if (options.acceptStale && this.shouldTriggerBackgroundRefresh(l4Result)) {
          this.triggerBackgroundRefresh(url, hash).catch(err =>
            cacheLogger.error({ url, error: err instanceof Error ? err.message : String(err) }, "Background refresh failed")
          );
        }
        return this.hit("L4", l4Result, startTime);
      }
    }

    return this.miss(startTime);
  }

  async set(url: string, page: CachedPage, options: SetOptions = {}): Promise<void> {
    const normalizedUrl = normalizeUrl(url);
    const hash = getCacheKey(normalizedUrl);
    const skipLevels = new Set(options.skipLevels ?? []);

    // Calculate TTL based on content type
    const contentType = options.contentType ?? page.contentType ?? "generic";
    const baseTtlMs = options.ttlMs ?? this.getBaseTtl(contentType);

    // Extract domain for tracking
    const domain = this.extractDomain(normalizedUrl);

    // Store in all levels (parallel for performance)
    const promises: Promise<void>[] = [];

    // Track hash for this domain in Redis SET (for domain invalidation)
    if (domain) {
      promises.push(this.trackDomainHash(domain, hash));
    }

    if (!skipLevels.has("L1")) {
      promises.push(
        this.l1.set(hash, page, this.getTtlForLevel(baseTtlMs, "L1"))
      );
    }

    if (!skipLevels.has("L2")) {
      promises.push(
        this.l2.set(hash, page, this.getTtlForLevel(baseTtlMs, "L2"))
      );
    }

    if (!skipLevels.has("L3") && options.clientId) {
      const l3Cache = this.getL3Cache(options.clientId);
      promises.push(
        l3Cache.setWithUrl(hash, url, page, this.getTtlForLevel(baseTtlMs, "L3"))
      );
    } else if (!skipLevels.has("L3") && !options.clientId) {
      cacheLogger.warn({ url }, "L3 cache set skipped: clientId not provided for tenant isolation");
    }

    if (!skipLevels.has("L4")) {
      promises.push(
        this.l4.set(hash, page, this.getTtlForLevel(baseTtlMs, "L4"))
      );
    }

    await Promise.all(promises);
  }

  /**
   * Invalidate a URL from all cache levels.
   * Note: For L3, this invalidates across ALL tenants for the URL.
   * Use invalidateForClient() for tenant-scoped invalidation.
   */
  async invalidate(url: string): Promise<void> {
    const hash = getCacheKey(normalizeUrl(url));

    // Invalidate from L1, L2 (shared across tenants)
    // L3 invalidation across all tenants
    const l3Deletions = Array.from(this.l3Caches.values()).map(cache => cache.delete(hash));

    await Promise.all([
      this.l1.delete(hash),
      this.l2.delete(hash),
      ...l3Deletions,
      // L4 is archive - don't delete, just let it expire
    ]);
  }

  /**
   * Invalidate a URL from cache for a specific client.
   * Phase 97: Tenant-scoped invalidation.
   */
  async invalidateForClient(url: string, clientId: string): Promise<void> {
    const hash = getCacheKey(normalizeUrl(url));

    const l3Cache = this.l3Caches.get(clientId);

    await Promise.all([
      this.l1.delete(hash),
      this.l2.delete(hash),
      l3Cache?.delete(hash),
    ]);
  }

  async invalidateDomain(domain: string): Promise<void> {
    // Get all hashes for this domain from Redis SET
    const domainKey = `${DOMAIN_TRACKING_PREFIX}${domain}`;

    try {
      const hashes = await this.redis.smembers(domainKey);

      if (hashes.length > 0) {
        // Clear L1-L4 using the tracked hashes (parallel for performance)
        // This avoids clearing ALL L1 entries - only the domain's entries are removed
        // L3: Delete from all tenant caches
        const l3Caches = Array.from(this.l3Caches.values());

        await Promise.all(
          hashes.map((hash) =>
            Promise.all([
              this.l1.delete(hash),
              this.l2.delete(hash),
              ...l3Caches.map(cache => cache.delete(hash)),
              this.l4.delete(hash),
            ])
          )
        );

        // Clear the domain tracking SET
        await this.redis.del(domainKey);

        cacheLogger.debug(
          { domain, hashCount: hashes.length },
          "Domain invalidation completed with targeted L1 eviction"
        );
      }

      // CACHE-01: Publish invalidation event to notify other instances
      await this.publishInvalidationEvent("domain", domain);
    } catch (error) {
      // Log error but don't throw - partial success is acceptable
      cacheLogger.error(
        { domain, error: error instanceof Error ? error.message : String(error) },
        "Domain invalidation error"
      );
    }
  }

  /**
   * Pre-warm cache for a list of URLs.
   * Note: L3 prewarm requires clientId in options for tenant isolation.
   * Without clientId, only L4 results will be used.
   */
  async prewarm(urls: string[], clientId?: string): Promise<void> {
    // Batch fetch from L3/L4 and promote to L1/L2
    const hashes = urls.map((url) => getCacheKey(normalizeUrl(url)));

    // Try L3 first (faster) - only if clientId provided
    if (clientId) {
      const l3Cache = this.getL3Cache(clientId);
      const l3Results = await l3Cache.mget(hashes);

      // For any misses in L3, don't fetch from L4 during prewarm (too slow)
      // Just promote L3 hits to L1/L2
      for (const [hash, page] of l3Results) {
        await Promise.all([
          this.promoteToL1(hash, page),
          this.promoteToL2(hash, page),
        ]);
      }
    } else {
      cacheLogger.warn({}, "L3 prewarm skipped: clientId not provided for tenant isolation");
    }
  }

  getStats(): CacheStats {
    const l1Stats = this.l1.getStats();
    const l2Stats = this.l2.getStats();
    // Aggregate L3 stats across all tenant caches
    const l3Stats = this.getAggregatedL3Stats();
    const l4Stats = this.l4.getStats();

    const totalHits =
      l1Stats.hits + l2Stats.hits + l3Stats.hits + l4Stats.hits;
    const totalMisses =
      l1Stats.misses + l2Stats.misses + l3Stats.misses + l4Stats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      l1: l1Stats,
      l2: l2Stats,
      l3: l3Stats,
      l4: l4Stats,
      totalHitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      avgLatencyMs:
        this.totalRequests > 0 ? this.totalLatencyMs / this.totalRequests : 0,
      totalRequests: this.totalRequests,
      lastResetAt: this.lastResetAt,
    };
  }

  /**
   * Get aggregated L3 stats across all tenant caches.
   */
  private getAggregatedL3Stats(): { hits: number; misses: number; hitRate: number; avgLatencyMs: number } {
    let totalHits = 0;
    let totalMisses = 0;
    let totalLatency = 0;
    let cacheCount = 0;

    for (const cache of this.l3Caches.values()) {
      const stats = cache.getStats();
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalLatency += stats.avgLatencyMs;
      cacheCount++;
    }

    const total = totalHits + totalMisses;
    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: total > 0 ? totalHits / total : 0,
      avgLatencyMs: cacheCount > 0 ? totalLatency / cacheCount : 0,
    };
  }

  resetStats(): void {
    this.l1.resetStats();
    this.l2.resetStats();
    // Reset all tenant L3 caches
    for (const cache of this.l3Caches.values()) {
      cache.resetStats();
    }
    this.l4.resetStats();
    this.totalRequests = 0;
    this.totalLatencyMs = 0;
    this.lastResetAt = new Date();
  }

  async shouldSkipCache(url: string): Promise<boolean> {
    const hash = getCacheKey(normalizeUrl(url));
    return this.l2.shouldSkipCache(hash);
  }

  async getRevalidationHeaders(url: string): Promise<RevalidationHeaders | null> {
    const hash = getCacheKey(normalizeUrl(url));
    return this.l2.getRevalidationHeaders(hash);
  }

  async handleInvalidation(event: InvalidationEvent): Promise<void> {
    switch (event.type) {
      case "url_changed":
        if (event.url) {
          await this.invalidate(event.url);
        }
        break;

      case "domain_updated":
        if (event.domain) {
          await this.invalidateDomain(event.domain);
        }
        break;

      case "audit_started":
        // Pre-warm cache for audit URLs
        if (event.urls) {
          await this.prewarm(event.urls);
        }
        break;

      case "force_refresh":
        if (event.url) {
          const hash = getCacheKey(normalizeUrl(event.url));
          await this.l2.markSkipCache(hash, 300); // 5 minutes
        }
        break;

      case "ttl_expired":
        // Already handled by each level's TTL mechanism
        break;
    }
  }

  // ===========================================================================
  // Additional Methods
  // ===========================================================================

  /**
   * Get individual cache level instance (for testing/debugging).
   * Note: For L3, returns the cache for the specified clientId, or undefined if not found.
   */
  getLevel(level: CacheLevel, clientId?: string): L1Cache | L2Cache | L3Cache | L4Cache | undefined {
    switch (level) {
      case "L1":
        return this.l1;
      case "L2":
        return this.l2;
      case "L3":
        return clientId ? this.l3Caches.get(clientId) : undefined;
      case "L4":
        return this.l4;
    }
  }

  /**
   * Get storage statistics from all levels.
   * Note: L3 stats are aggregated across all tenant caches.
   */
  async getStorageStats(clientId?: string): Promise<{
    l1: { sizeBytes: number; itemCount: number };
    l3: Awaited<ReturnType<L3Cache["getStorageStats"]>>;
    l4: Awaited<ReturnType<L4Cache["getStorageStats"]>>;
  }> {
    // Get L3 stats for specific client or aggregate
    let l3Stats: Awaited<ReturnType<L3Cache["getStorageStats"]>>;
    if (clientId && this.l3Caches.has(clientId)) {
      l3Stats = await this.l3Caches.get(clientId)!.getStorageStats();
    } else {
      // Aggregate across all tenant caches
      l3Stats = {
        totalEntries: 0,
        totalAliases: 0,
        totalSizeBytes: 0,
        avgSizeBytes: 0,
        oldestEntry: null,
        newestEntry: null,
      };
      for (const cache of this.l3Caches.values()) {
        const stats = await cache.getStorageStats();
        l3Stats.totalEntries += stats.totalEntries;
        l3Stats.totalAliases += stats.totalAliases;
        l3Stats.totalSizeBytes += stats.totalSizeBytes;
        if (stats.oldestEntry && (!l3Stats.oldestEntry || stats.oldestEntry < l3Stats.oldestEntry)) {
          l3Stats.oldestEntry = stats.oldestEntry;
        }
        if (stats.newestEntry && (!l3Stats.newestEntry || stats.newestEntry > l3Stats.newestEntry)) {
          l3Stats.newestEntry = stats.newestEntry;
        }
      }
      if (l3Stats.totalEntries > 0) {
        l3Stats.avgSizeBytes = l3Stats.totalSizeBytes / l3Stats.totalEntries;
      }
    }

    const l4Stats = await this.l4.getStorageStats();

    return {
      l1: {
        sizeBytes: this.l1.getCurrentSize(),
        itemCount: this.l1.getItemCount(),
      },
      l3: l3Stats,
      l4: l4Stats,
    };
  }

  /**
   * Run maintenance tasks (cleanup expired entries).
   * Runs across all tenant L3 caches.
   */
  async runMaintenance(): Promise<{
    l3DeletedCount: number;
  }> {
    let l3DeletedCount = 0;
    for (const cache of this.l3Caches.values()) {
      l3DeletedCount += await cache.deleteExpired();
    }

    return { l3DeletedCount };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create a cache hit result.
   */
  private hit(level: CacheLevel, data: CachedPage, startTime: number): CacheResult {
    const latencyMs = performance.now() - startTime;
    this.totalLatencyMs += latencyMs;

    return {
      hit: true,
      level,
      data,
      latencyMs,
    };
  }

  /**
   * Create a cache miss result.
   */
  private miss(startTime: number): CacheResult {
    const latencyMs = performance.now() - startTime;
    this.totalLatencyMs += latencyMs;

    return {
      hit: false,
      latencyMs,
    };
  }

  /**
   * Check if cached page is valid (not expired or acceptStale).
   */
  private isValid(page: CachedPage, acceptStale?: boolean): boolean {
    if (acceptStale) return true;
    return page.expiresAt > new Date();
  }

  /**
   * Promote page to L1 cache.
   */
  private async promoteToL1(hash: string, page: CachedPage): Promise<void> {
    const ttlMs = this.getRemainingTtl(page.expiresAt);
    if (ttlMs > 0) {
      await this.l1.set(hash, page, Math.min(ttlMs, this.config.l1.defaultTtlMs));
    }
  }

  /**
   * Promote page to L2 cache.
   */
  private async promoteToL2(hash: string, page: CachedPage): Promise<void> {
    const ttlMs = this.getRemainingTtl(page.expiresAt);
    if (ttlMs > 0) {
      await this.l2.set(hash, page, ttlMs);
    }
  }

  /**
   * Promote page to L3 cache.
   * Requires clientId for tenant isolation.
   */
  private async promoteToL3(
    hash: string,
    url: string,
    page: CachedPage,
    clientId?: string
  ): Promise<void> {
    if (!clientId) {
      cacheLogger.warn({ url }, "L3 promotion skipped: clientId not provided for tenant isolation");
      return;
    }
    const ttlMs = this.getRemainingTtl(page.expiresAt);
    if (ttlMs > 0) {
      const l3Cache = this.getL3Cache(clientId);
      await l3Cache.setWithUrl(hash, url, page, ttlMs);
    }
  }

  /**
   * Get remaining TTL in milliseconds.
   */
  private getRemainingTtl(expiresAt: Date): number {
    return Math.max(0, expiresAt.getTime() - Date.now());
  }

  /**
   * Get base TTL for content type.
   */
  private getBaseTtl(contentType: string): number {
    const TTL_MAP: Record<string, number> = {
      corporate: 7 * 24 * 60 * 60 * 1000, // 7 days
      blog_post: 24 * 60 * 60 * 1000, // 24 hours
      product: 4 * 60 * 60 * 1000, // 4 hours
      category: 12 * 60 * 60 * 1000, // 12 hours
      homepage: 4 * 60 * 60 * 1000, // 4 hours
      dynamic: 1 * 60 * 60 * 1000, // 1 hour
      generic: 12 * 60 * 60 * 1000, // 12 hours (default)
    };

    return TTL_MAP[contentType] ?? TTL_MAP.generic;
  }

  /**
   * Get TTL for a specific cache level.
   */
  private getTtlForLevel(baseTtlMs: number, level: CacheLevel): number {
    const MULTIPLIERS: Record<CacheLevel, number> = {
      L1: 0.1, // L1 TTL = 10% of base
      L2: 0.5, // L2 TTL = 50% of base
      L3: 1.0, // L3 TTL = 100% of base
      L4: 3.0, // L4 TTL = 300% of base (archive retention)
    };

    return Math.round(baseTtlMs * MULTIPLIERS[level]);
  }

  /**
   * Track a cache hash for a domain in Redis SET.
   * Used for domain-level cache invalidation.
   */
  private async trackDomainHash(domain: string, hash: string): Promise<void> {
    const domainKey = `${DOMAIN_TRACKING_PREFIX}${domain}`;

    try {
      // Add hash to domain's SET
      await this.redis.sadd(domainKey, hash);

      // Set/refresh TTL on the domain SET (30 days)
      await this.redis.expire(domainKey, DOMAIN_TRACKING_TTL_SECONDS);
    } catch (error) {
      // Non-critical - log and continue
      cacheLogger.error(
        { domain, hash, error: error instanceof Error ? error.message : String(error) },
        "Failed to track domain hash"
      );
    }
  }

  /**
   * Extract domain from a URL string.
   */
  private extractDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Stale-While-Revalidate Methods
  // ===========================================================================

  /**
   * Determine if a cached page should trigger a background refresh.
   * Uses both proactive refresh (freshness < 20%) and stale-while-revalidate logic.
   */
  private shouldTriggerBackgroundRefresh(page: CachedPage): boolean {
    // Check if content is stale but within acceptable stale window
    const isStaleButServable = shouldServeStale(page.expiresAt, page.fetchedAt);

    // Check if content should be proactively refreshed (< 20% fresh)
    const needsProactiveRefresh = shouldProactivelyRefresh(page.fetchedAt, page.expiresAt);

    return isStaleButServable || needsProactiveRefresh;
  }

  /**
   * Trigger a non-blocking background refresh for a URL.
   * Uses Redis pub/sub to queue a low-priority refresh job.
   * Deduplicates requests to prevent multiple refreshes for the same URL.
   */
  private async triggerBackgroundRefresh(url: string, hash: string): Promise<void> {
    // Skip if refresh is already pending for this hash
    if (this.pendingRefreshes.has(hash)) {
      cacheLogger.debug({ url, hash }, "Background refresh already pending, skipping");
      return;
    }

    // Mark as pending to prevent duplicate refreshes
    this.pendingRefreshes.add(hash);

    try {
      // Publish a refresh request via Redis pub/sub
      // This allows any worker to pick up the refresh job
      const refreshMessage = JSON.stringify({
        type: "cache_refresh",
        url,
        hash,
        timestamp: Date.now(),
        priority: "low",
      });

      await this.redis.publish("scraping:cache:refresh", refreshMessage);
      this.backgroundRefreshCount++;

      cacheLogger.debug(
        { url, hash, refreshCount: this.backgroundRefreshCount },
        "Background refresh triggered"
      );

      // Auto-clear pending status after 5 minutes (in case refresh never completes)
      setTimeout(() => {
        this.pendingRefreshes.delete(hash);
      }, 5 * 60 * 1000);
    } catch (error) {
      this.backgroundRefreshFailures++;
      this.pendingRefreshes.delete(hash);

      cacheLogger.warn(
        { url, hash, error: error instanceof Error ? error.message : String(error) },
        "Failed to trigger background refresh"
      );
    }
  }

  /**
   * Get stale-while-revalidate metrics for monitoring.
   */
  getSwrMetrics(): {
    pendingRefreshes: number;
    totalRefreshesTriggered: number;
    refreshFailures: number;
  } {
    return {
      pendingRefreshes: this.pendingRefreshes.size,
      totalRefreshesTriggered: this.backgroundRefreshCount,
      refreshFailures: this.backgroundRefreshFailures,
    };
  }

  /**
   * Clear a pending refresh (called when refresh completes externally).
   */
  clearPendingRefresh(hash: string): void {
    this.pendingRefreshes.delete(hash);
  }

  // ===========================================================================
  // Cross-Instance Invalidation Methods (CACHE-01)
  // ===========================================================================

  /**
   * Initialize Redis pub/sub subscription for cross-instance cache invalidation.
   * Creates a duplicate connection for subscribing (ioredis requirement).
   */
  private initializeInvalidationSubscription(): void {
    try {
      // Create a dedicated subscriber connection (ioredis requires separate connection for subscribe)
      this.subscriber = this.redis.duplicate();

      // Handle subscription messages
      this.subscriber.on("message", (channel: string, message: string) => {
        if (channel === UNIFIED_INVALIDATION_CHANNEL) {
          this.handleInvalidationMessage(message).catch((error) => {
            cacheLogger.error(
              { error: error instanceof Error ? error.message : String(error) },
              "Error handling invalidation message"
            );
          });
        }
      });

      // Handle reconnection - resubscribe after Redis reconnect
      this.subscriber.on("ready", () => {
        if (!this.isSubscribed) {
          this.subscribeToInvalidationChannel();
        }
      });

      // Handle connection errors gracefully
      this.subscriber.on("error", (error) => {
        cacheLogger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "Cache invalidation subscriber error (will retry)"
        );
      });

      // Handle disconnect
      this.subscriber.on("close", () => {
        this.isSubscribed = false;
        cacheLogger.debug({}, "Cache invalidation subscriber disconnected");
      });

      // Initial subscription
      this.subscribeToInvalidationChannel();
    } catch (error) {
      // Non-fatal - log and continue without cross-instance invalidation
      cacheLogger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to initialize cache invalidation subscription"
      );
    }
  }

  /**
   * Subscribe to the invalidation channel.
   */
  private subscribeToInvalidationChannel(): void {
    if (!this.subscriber || this.isSubscribed) return;

    this.subscriber
      .subscribe(UNIFIED_INVALIDATION_CHANNEL)
      .then(() => {
        this.isSubscribed = true;
        cacheLogger.debug(
          { channel: UNIFIED_INVALIDATION_CHANNEL, instanceId: INSTANCE_ID, cacheType: SCRAPING_CACHE_TYPE },
          "Subscribed to unified cache invalidation channel"
        );
      })
      .catch((error) => {
        cacheLogger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "Failed to subscribe to invalidation channel"
        );
      });
  }

  /**
   * Publish an invalidation event to notify other instances.
   * Uses unified message format with type="scraping".
   */
  private async publishInvalidationEvent(
    invalidationType: InvalidationMessageType,
    pattern: string
  ): Promise<void> {
    try {
      // Use unified message format
      const message: UnifiedInvalidationMessage = {
        type: SCRAPING_CACHE_TYPE,
        keys: invalidationType === "url" ? [pattern] : [],
        patterns: invalidationType === "domain" ? [`osm:scrape:${pattern}:*`] : [],
        source: INSTANCE_ID,
        timestamp: Date.now(),
        reason: `scraping_${invalidationType}_invalidate`,
      };

      await this.redis.publish(UNIFIED_INVALIDATION_CHANNEL, JSON.stringify(message));
      this.invalidationEventsPublished++;

      cacheLogger.debug(
        { cacheType: SCRAPING_CACHE_TYPE, invalidationType, pattern, instanceId: INSTANCE_ID },
        "Published cache invalidation event"
      );
    } catch (error) {
      // Non-fatal - local invalidation already succeeded
      cacheLogger.warn(
        { invalidationType, pattern, error: error instanceof Error ? error.message : String(error) },
        "Failed to publish cache invalidation event"
      );
    }
  }

  /**
   * Handle an incoming invalidation message from another instance.
   * Only processes messages with type="scraping".
   */
  private async handleInvalidationMessage(messageStr: string): Promise<void> {
    try {
      const message = JSON.parse(messageStr) as UnifiedInvalidationMessage;

      // Skip messages from this instance (we already invalidated locally)
      if (message.source === INSTANCE_ID) {
        return;
      }

      // Filter by cache type - only process scraping invalidations
      if (message.type !== SCRAPING_CACHE_TYPE) {
        cacheLogger.debug(
          { messageType: message.type, ourType: SCRAPING_CACHE_TYPE },
          "Ignoring invalidation for different cache type"
        );
        return;
      }

      this.invalidationEventsReceived++;

      cacheLogger.debug(
        { type: message.type, keys: message.keys.length, patterns: message.patterns.length, fromInstance: message.source },
        "Received cache invalidation event"
      );

      // Clear L1 based on message content
      // L2/L3/L4 are already cleared by the originating instance (they're shared)

      // Handle exact key invalidation
      for (const key of message.keys) {
        const hash = getCacheKey(normalizeUrl(key));
        await this.l1.delete(hash);
      }

      // Handle pattern invalidation (extract domain from pattern)
      for (const pattern of message.patterns) {
        // Pattern format: osm:scrape:{domain}:*
        const domainMatch = pattern.match(/^osm:scrape:([^:]+):\*$/);
        if (domainMatch) {
          await this.invalidateL1ForDomain(domainMatch[1]);
        }
      }

      // If reason indicates full clear
      if (message.reason === "scraping_all_invalidate") {
        await this.l1.clear();
      }
    } catch (error) {
      cacheLogger.warn(
        { message: messageStr, error: error instanceof Error ? error.message : String(error) },
        "Failed to parse invalidation message"
      );
    }
  }

  /**
   * Invalidate L1 cache entries for a specific domain using Redis domain tracking.
   * Used for cross-instance domain invalidation where only L1 needs clearing.
   */
  private async invalidateL1ForDomain(domain: string): Promise<void> {
    const domainKey = `${DOMAIN_TRACKING_PREFIX}${domain}`;

    try {
      const hashes = await this.redis.smembers(domainKey);

      if (hashes.length > 0) {
        // Delete only the domain's entries from L1
        await Promise.all(hashes.map((hash) => this.l1.delete(hash)));

        cacheLogger.debug(
          { domain, hashCount: hashes.length },
          "Cross-instance L1 invalidation completed"
        );
      }
    } catch (error) {
      // Fallback to clearing all L1 if domain tracking fails
      cacheLogger.warn(
        { domain, error: error instanceof Error ? error.message : String(error) },
        "Domain tracking lookup failed, falling back to full L1 clear"
      );
      await this.l1.clear();
    }
  }

  /**
   * Get invalidation metrics for monitoring.
   */
  getInvalidationMetrics(): {
    eventsPublished: number;
    eventsReceived: number;
    isSubscribed: boolean;
  } {
    return {
      eventsPublished: this.invalidationEventsPublished,
      eventsReceived: this.invalidationEventsReceived,
      isSubscribed: this.isSubscribed,
    };
  }

  /**
   * Cleanup method for graceful shutdown.
   * Should be called when the application is shutting down.
   */
  async shutdown(): Promise<void> {
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(UNIFIED_INVALIDATION_CHANNEL);
        this.subscriber.disconnect();
        this.subscriber = null;
        this.isSubscribed = false;
        cacheLogger.debug({}, "Cache invalidation subscriber shutdown complete");
      } catch (error) {
        cacheLogger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "Error during cache invalidation subscriber shutdown"
        );
      }
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new CacheManager instance.
 *
 * The returned CacheManager automatically subscribes to Redis pub/sub
 * for cross-instance L1 cache invalidation. Call shutdown() on the
 * instance during application shutdown to clean up the subscriber connection.
 *
 * Phase 97: Tenant isolation is enforced at operation time via clientId in
 * GetOptions/SetOptions. L3 cache instances are created per-client lazily.
 *
 * @param deps.redis - Redis connection
 * @param deps.db - PostgreSQL database connection
 * @param deps.config - Optional cache configuration
 */
export function createCacheManager(deps: {
  redis: Redis;
  db: PostgresJsDatabase;
  config?: Partial<CacheConfig>;
}): CacheManager {
  return new CacheManager(deps);
}
