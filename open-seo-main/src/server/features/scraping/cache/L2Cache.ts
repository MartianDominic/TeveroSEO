/**
 * L2 Redis Cache
 * Phase 95-02: Multi-Level Caching
 *
 * Redis-backed cache for cross-worker sharing with compression.
 * - TTL: 1-24 hours (content-type dependent)
 * - Compression: gzip (similar performance to LZ4)
 * - Eviction: volatile-lru (only evict keys with TTL)
 */

import type { Redis } from "ioredis";
import type {
  CachedPage,
  CacheLevel,
  ICacheLevel,
  L2CacheConfig,
  LevelStats,
  ContentType,
  RevalidationHeaders,
} from "./types";
import {
  compressToBase64,
  decompressFromBase64,
  shouldCompress,
} from "./compression";
import { cacheLogger } from "../logging";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: L2CacheConfig = {
  maxMemory: "2gb",
  compressionEnabled: true,
  compressionAlgo: "lz4", // Using gzip as LZ4 equivalent
  keyPrefix: "cache:",
};

// Key prefixes for different data types
const KEY_PREFIXES = {
  html: "html:",
  meta: "meta:",
  etag: "etag:",
  skip: "skip:",
} as const;

// =============================================================================
// Serialization
// =============================================================================

interface SerializedPage {
  html: string; // Possibly compressed, base64 encoded
  compressed: boolean;
  contentHash: string;
  fetchedAt: string; // ISO string
  expiresAt: string;
  tierUsed: string;
  statusCode: number;
  pageSizeBytes: number;
  etag?: string;
  lastModified?: string;
  contentType?: ContentType;
  parsedData?: string; // JSON stringified
}

function serializePage(page: CachedPage, compress: boolean): string {
  const serialized: SerializedPage = {
    html: compress && shouldCompress(page.html)
      ? compressToBase64(page.html)
      : page.html,
    compressed: compress && shouldCompress(page.html),
    contentHash: page.contentHash,
    fetchedAt: page.fetchedAt.toISOString(),
    expiresAt: page.expiresAt.toISOString(),
    tierUsed: page.tierUsed,
    statusCode: page.statusCode,
    pageSizeBytes: page.pageSizeBytes,
    etag: page.etag,
    lastModified: page.lastModified,
    contentType: page.contentType,
    parsedData: page.parsedData ? JSON.stringify(page.parsedData) : undefined,
  };

  return JSON.stringify(serialized);
}

function deserializePage(data: string): CachedPage {
  const serialized: SerializedPage = JSON.parse(data);

  return {
    html: serialized.compressed
      ? decompressFromBase64(serialized.html)
      : serialized.html,
    contentHash: serialized.contentHash,
    fetchedAt: new Date(serialized.fetchedAt),
    expiresAt: new Date(serialized.expiresAt),
    tierUsed: serialized.tierUsed as CachedPage["tierUsed"],
    statusCode: serialized.statusCode,
    pageSizeBytes: serialized.pageSizeBytes,
    etag: serialized.etag,
    lastModified: serialized.lastModified,
    contentType: serialized.contentType,
    parsedData: serialized.parsedData
      ? JSON.parse(serialized.parsedData)
      : undefined,
  };
}

// =============================================================================
// L2Cache Implementation
// =============================================================================

/**
 * L2 Redis Cache implementation.
 *
 * Provides cross-worker cache sharing with:
 * - Gzip compression for HTML storage
 * - TTL-based expiration
 * - ETag/Last-Modified storage for conditional GET
 */
export class L2Cache implements ICacheLevel {
  readonly level: CacheLevel = "L2";

  private redis: Redis;
  private config: L2CacheConfig;

  // Stats tracking
  private hits = 0;
  private misses = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;

  constructor(redis: Redis, config: Partial<L2CacheConfig> = {}) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // ICacheLevel Implementation
  // ===========================================================================

  async get(hash: string): Promise<CachedPage | null> {
    const startTime = performance.now();
    this.requestCount++;

    try {
      const key = this.makeKey("html", hash);
      const data = await this.redis.get(key);

      if (data) {
        this.hits++;
        return deserializePage(data);
      }

      this.misses++;
      return null;
    } catch (error) {
      this.misses++;
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] Get error:", error);
      return null;
    } finally {
      this.totalLatencyMs += performance.now() - startTime;
    }
  }

  async set(hash: string, page: CachedPage, ttlMs: number): Promise<void> {
    try {
      const key = this.makeKey("html", hash);
      const data = serializePage(page, this.config.compressionEnabled);
      const ttlSeconds = Math.ceil(ttlMs / 1000);

      await this.redis.setex(key, ttlSeconds, data);

      // Also store ETag/Last-Modified for conditional GET
      if (page.etag || page.lastModified) {
        await this.setRevalidationHeaders(hash, {
          etag: page.etag,
          lastModified: page.lastModified,
        });
      }
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] Set error:", error);
    }
  }

  async delete(hash: string): Promise<void> {
    try {
      const keys = [
        this.makeKey("html", hash),
        this.makeKey("meta", hash),
        this.makeKey("etag", hash),
      ];
      await this.redis.del(...keys);
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] Delete error:", error);
    }
  }

  async has(hash: string): Promise<boolean> {
    try {
      const key = this.makeKey("html", hash);
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] Has error:", error);
      return false;
    }
  }

  getStats(): LevelStats {
    const total = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      avgLatencyMs: this.requestCount > 0
        ? this.totalLatencyMs / this.requestCount
        : 0,
    };
  }

  async clear(): Promise<void> {
    try {
      // Use SCAN to find all cache keys and delete them
      let cursor = "0";
      const pattern = `${this.config.keyPrefix}*`;

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== "0");

      this.resetStats();
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] Clear error:", error);
    }
  }

  // ===========================================================================
  // Additional Methods
  // ===========================================================================

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.totalLatencyMs = 0;
    this.requestCount = 0;
  }

  /**
   * Get revalidation headers (ETag/Last-Modified) for a URL.
   */
  async getRevalidationHeaders(hash: string): Promise<RevalidationHeaders | null> {
    try {
      const key = this.makeKey("etag", hash);
      const data = await this.redis.hgetall(key);

      if (Object.keys(data).length === 0) {
        return null;
      }

      return {
        etag: data.etag || undefined,
        lastModified: data.lastModified || undefined,
      };
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] GetRevalidationHeaders error:", error);
      return null;
    }
  }

  /**
   * Set revalidation headers for a URL.
   */
  async setRevalidationHeaders(
    hash: string,
    headers: RevalidationHeaders,
    ttlSeconds = 86400 // 24 hours default
  ): Promise<void> {
    try {
      const key = this.makeKey("etag", hash);

      if (headers.etag) {
        await this.redis.hset(key, "etag", headers.etag);
      }
      if (headers.lastModified) {
        await this.redis.hset(key, "lastModified", headers.lastModified);
      }

      await this.redis.expire(key, ttlSeconds);
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] SetRevalidationHeaders error:", error);
    }
  }

  /**
   * Mark a URL to skip cache (force refresh).
   */
  async markSkipCache(hash: string, ttlSeconds = 300): Promise<void> {
    try {
      const key = this.makeKey("skip", hash);
      await this.redis.setex(key, ttlSeconds, "1");
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] MarkSkipCache error:", error);
    }
  }

  /**
   * Check if URL should skip cache.
   */
  async shouldSkipCache(hash: string): Promise<boolean> {
    try {
      const key = this.makeKey("skip", hash);
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] ShouldSkipCache error:", error);
      return false;
    }
  }

  /**
   * Extend TTL for a cached item.
   */
  async extendTtl(hash: string, ttlSeconds: number): Promise<boolean> {
    try {
      const key = this.makeKey("html", hash);
      const result = await this.redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] ExtendTtl error:", error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a cached item (in seconds).
   */
  async getRemainingTtl(hash: string): Promise<number | null> {
    try {
      const key = this.makeKey("html", hash);
      const ttl = await this.redis.ttl(key);
      return ttl >= 0 ? ttl : null;
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] GetRemainingTtl error:", error);
      return null;
    }
  }

  /**
   * Bulk get multiple items.
   */
  async mget(hashes: string[]): Promise<Map<string, CachedPage>> {
    const startTime = performance.now();
    const results = new Map<string, CachedPage>();

    try {
      if (hashes.length === 0) {
        return results;
      }

      const keys = hashes.map((h) => this.makeKey("html", h));
      const values = await this.redis.mget(...keys);

      for (let i = 0; i < hashes.length; i++) {
        const value = values[i];
        if (value) {
          this.hits++;
          results.set(hashes[i], deserializePage(value));
        } else {
          this.misses++;
        }
      }

      this.requestCount++;
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] Mget error:", error);
    } finally {
      this.totalLatencyMs += performance.now() - startTime;
    }

    return results;
  }

  /**
   * Get memory info from Redis.
   */
  async getMemoryInfo(): Promise<{
    used: number;
    peak: number;
    fragmentation: number;
  } | null> {
    try {
      const info = await this.redis.info("memory");
      const lines = info.split("\n");

      let used = 0;
      let peak = 0;
      let fragmentation = 1;

      for (const line of lines) {
        if (line.startsWith("used_memory:")) {
          used = parseInt(line.split(":")[1], 10);
        } else if (line.startsWith("used_memory_peak:")) {
          peak = parseInt(line.split(":")[1], 10);
        } else if (line.startsWith("mem_fragmentation_ratio:")) {
          fragmentation = parseFloat(line.split(":")[1]);
        }
      }

      return { used, peak, fragmentation };
    } catch (error) {
      cacheLogger.error({ error: error instanceof Error ? error.message : String(error) }, "[L2Cache] GetMemoryInfo error:", error);
      return null;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create a cache key with prefix.
   */
  private makeKey(type: keyof typeof KEY_PREFIXES, hash: string): string {
    return `${this.config.keyPrefix}${KEY_PREFIXES[type]}${hash}`;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new L2 cache instance.
 */
export function createL2Cache(
  redis: Redis,
  config?: Partial<L2CacheConfig>
): L2Cache {
  return new L2Cache(redis, config);
}
