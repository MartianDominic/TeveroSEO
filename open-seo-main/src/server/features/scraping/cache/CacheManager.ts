/**
 * CacheManager - Multi-Level Cache Orchestration
 * Phase 95-02: Multi-Level Caching
 *
 * Orchestrates the 4-tier caching system:
 * L1: Memory LRU (~100MB) - Sub-millisecond access
 * L2: Redis (~2GB) - Cross-worker sharing
 * L3: PostgreSQL (compressed) - Persistent storage
 * L4: Cloudflare R2 (archive) - Long-term archive
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
  LevelStats,
  TTL_BY_CONTENT_TYPE,
  TTL_LEVEL_MULTIPLIERS,
} from "./types";
import { normalizeUrl, getCacheKey } from "./urlNormalization";

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
    compressionAlgo: "lz4",
    keyPrefix: "cache:",
  },
  l3: {
    retentionDays: 30,
    compressionAlgo: "lz4",
    batchSize: 100,
  },
  l4: {
    bucket: process.env.R2_BUCKET ?? "scrape-archive",
    retentionDays: 90,
    compressionAlgo: "zstd",
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
 */
export class CacheManager implements ICacheManager {
  private l1: L1Cache;
  private l2: L2Cache;
  private l3: L3Cache;
  private l4: L4Cache;
  private config: CacheConfig;

  // Aggregate stats
  private totalRequests = 0;
  private totalLatencyMs = 0;
  private lastResetAt = new Date();

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

    this.l1 = createL1Cache(this.config.l1);
    this.l2 = createL2Cache(deps.redis, this.config.l2);
    this.l3 = createL3Cache(deps.db, this.config.l3);
    this.l4 = createL4Cache(this.config.l4);
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
        return this.hit("L2", l2Result, startTime);
      }
    }
    if (maxLevel === "L2") return this.miss(startTime);

    // L3: PostgreSQL
    if (!skipLevels.has("L3")) {
      const l3Result = await this.l3.get(hash);
      if (l3Result && this.isValid(l3Result, options.acceptStale)) {
        // Promote to L1 and L2
        await Promise.all([
          this.promoteToL1(hash, l3Result),
          this.promoteToL2(hash, l3Result),
        ]);
        return this.hit("L3", l3Result, startTime);
      }
    }
    if (maxLevel === "L3") return this.miss(startTime);

    // L4: R2 Archive
    if (!skipLevels.has("L4")) {
      const l4Result = await this.l4.get(hash);
      if (l4Result) {
        // Promote to all levels
        await Promise.all([
          this.promoteToL1(hash, l4Result),
          this.promoteToL2(hash, l4Result),
          this.promoteToL3(hash, url, l4Result),
        ]);
        return this.hit("L4", l4Result, startTime);
      }
    }

    return this.miss(startTime);
  }

  async set(url: string, page: CachedPage, options: SetOptions = {}): Promise<void> {
    const hash = getCacheKey(normalizeUrl(url));
    const skipLevels = new Set(options.skipLevels ?? []);

    // Calculate TTL based on content type
    const contentType = options.contentType ?? page.contentType ?? "generic";
    const baseTtlMs = options.ttlMs ?? this.getBaseTtl(contentType);

    // Store in all levels (parallel for performance)
    const promises: Promise<void>[] = [];

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

    if (!skipLevels.has("L3")) {
      promises.push(
        this.l3.setWithUrl(hash, url, page, this.getTtlForLevel(baseTtlMs, "L3"))
      );
    }

    if (!skipLevels.has("L4")) {
      promises.push(
        this.l4.set(hash, page, this.getTtlForLevel(baseTtlMs, "L4"))
      );
    }

    await Promise.all(promises);
  }

  async invalidate(url: string): Promise<void> {
    const hash = getCacheKey(normalizeUrl(url));

    // Invalidate from all levels (parallel)
    await Promise.all([
      this.l1.delete(hash),
      this.l2.delete(hash),
      this.l3.delete(hash),
      // L4 is archive - don't delete, just let it expire
    ]);
  }

  async invalidateDomain(domain: string): Promise<void> {
    // For L1, we need to iterate keys (not efficient, but L1 is small)
    const l1Keys = this.l1.getKeys();
    for (const key of l1Keys) {
      // Key format: html:{hash}
      // We can't easily map hash back to domain without additional tracking
      // For now, just clear L1 entirely for domain invalidation
    }

    // Clear L1 entirely for domain invalidation (conservative approach)
    await this.l1.clear();

    // For L2/L3, we would need domain->hash tracking
    // This is a simplified implementation
    console.warn(
      `[CacheManager] Domain invalidation for ${domain} cleared L1 only. L2/L3/L4 require hash tracking.`
    );
  }

  async prewarm(urls: string[]): Promise<void> {
    // Batch fetch from L3/L4 and promote to L1/L2
    const hashes = urls.map((url) => getCacheKey(normalizeUrl(url)));

    // Try L3 first (faster)
    const l3Results = await this.l3.mget(hashes);

    // For any misses in L3, don't fetch from L4 during prewarm (too slow)
    // Just promote L3 hits to L1/L2
    for (const [hash, page] of l3Results) {
      await Promise.all([
        this.promoteToL1(hash, page),
        this.promoteToL2(hash, page),
      ]);
    }
  }

  getStats(): CacheStats {
    const l1Stats = this.l1.getStats();
    const l2Stats = this.l2.getStats();
    const l3Stats = this.l3.getStats();
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

  resetStats(): void {
    this.l1.resetStats();
    this.l2.resetStats();
    this.l3.resetStats();
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
   */
  getLevel(level: CacheLevel): L1Cache | L2Cache | L3Cache | L4Cache {
    switch (level) {
      case "L1":
        return this.l1;
      case "L2":
        return this.l2;
      case "L3":
        return this.l3;
      case "L4":
        return this.l4;
    }
  }

  /**
   * Get storage statistics from all levels.
   */
  async getStorageStats(): Promise<{
    l1: { sizeBytes: number; itemCount: number };
    l3: Awaited<ReturnType<L3Cache["getStorageStats"]>>;
    l4: Awaited<ReturnType<L4Cache["getStorageStats"]>>;
  }> {
    const [l3Stats, l4Stats] = await Promise.all([
      this.l3.getStorageStats(),
      this.l4.getStorageStats(),
    ]);

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
   */
  async runMaintenance(): Promise<{
    l3DeletedCount: number;
  }> {
    const l3DeletedCount = await this.l3.deleteExpired();

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
   */
  private async promoteToL3(
    hash: string,
    url: string,
    page: CachedPage
  ): Promise<void> {
    const ttlMs = this.getRemainingTtl(page.expiresAt);
    if (ttlMs > 0) {
      await this.l3.setWithUrl(hash, url, page, ttlMs);
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
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new CacheManager instance.
 */
export function createCacheManager(deps: {
  redis: Redis;
  db: PostgresJsDatabase;
  config?: Partial<CacheConfig>;
}): CacheManager {
  return new CacheManager(deps);
}
