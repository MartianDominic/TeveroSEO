/**
 * L3 PostgreSQL Cache
 * Phase 95-02: Multi-Level Caching
 * Phase 95-18: Resilience Hardening - Circuit Breaker Integration
 *
 * Persistent PostgreSQL cache for HTML content.
 * - TTL: 7-30 days (content-type dependent)
 * - Compression: gzip
 * - Supports content deduplication via aliases
 * - Circuit breaker protection for database operations
 */

import { eq, and, gt, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { htmlCache, htmlCacheAliases } from "@/db/cache-schema";
import type {
  CachedPage,
  CacheLevel,
  ICacheLevel,
  L3CacheConfig,
  LevelStats,
} from "./types";
import {
  compressToBase64,
  decompressFromBase64,
  shouldCompress,
} from "./compression";
import { getDatabaseCircuitBreaker, CircuitOpenError } from "../resilience/DatabaseCircuitBreaker";
import { createComponentLogger } from "../logging";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: L3CacheConfig = {
  retentionDays: 30,
  compressionAlgo: "lz4", // Using gzip as equivalent
  batchSize: 100,
};

// =============================================================================
// Logger
// =============================================================================

const logger = createComponentLogger("l3-cache");

// =============================================================================
// L3Cache Implementation
// =============================================================================

/**
 * L3 PostgreSQL Cache implementation.
 *
 * Provides persistent HTML storage with:
 * - Gzip compression for storage efficiency
 * - Content deduplication via aliases table
 * - Efficient batch operations
 */
export class L3Cache implements ICacheLevel {
  readonly level: CacheLevel = "L3";

  private db: PostgresJsDatabase;
  private config: L3CacheConfig;

  // Stats tracking
  private hits = 0;
  private misses = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;

  constructor(
    db: PostgresJsDatabase,
    config: Partial<L3CacheConfig> = {}
  ) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // ICacheLevel Implementation
  // ===========================================================================

  async get(hash: string): Promise<CachedPage | null> {
    const startTime = performance.now();
    this.requestCount++;
    const circuitBreaker = getDatabaseCircuitBreaker();

    try {
      // Use circuit breaker for database operations
      const result = await circuitBreaker.executeOrNull(async () => {
        // First check if this is an alias
        const alias = await this.db
          .select({ canonicalId: htmlCacheAliases.canonicalId })
          .from(htmlCacheAliases)
          .where(eq(htmlCacheAliases.aliasUrlHash, hash))
          .limit(1);

        let row;

        if (alias.length > 0) {
          // Fetch by canonical ID
          const results = await this.db
            .select()
            .from(htmlCache)
            .where(
              and(
                eq(htmlCache.id, alias[0].canonicalId),
                gt(htmlCache.expiresAt, new Date())
              )
            )
            .limit(1);
          row = results[0];
        } else {
          // Fetch by URL hash directly
          const results = await this.db
            .select()
            .from(htmlCache)
            .where(
              and(
                eq(htmlCache.urlHash, hash),
                gt(htmlCache.expiresAt, new Date())
              )
            )
            .limit(1);
          row = results[0];
        }

        return row;
      });

      if (result) {
        this.hits++;
        return this.rowToCachedPage(result);
      }

      this.misses++;
      return null;
    } catch (error) {
      this.misses++;
      if (error instanceof CircuitOpenError) {
        logger.debug("L3Cache get skipped - circuit open", { hash });
      } else {
        logger.error("L3Cache get error", { error: error instanceof Error ? error.message : String(error) });
      }
      return null;
    } finally {
      this.totalLatencyMs += performance.now() - startTime;
    }
  }

  async set(hash: string, page: CachedPage, ttlMs: number): Promise<void> {
    const circuitBreaker = getDatabaseCircuitBreaker();

    try {
      await circuitBreaker.executeOrNull(async () => {
        const compressedHtml = shouldCompress(page.html)
          ? compressToBase64(page.html)
          : page.html;

        const expiresAt = new Date(Date.now() + ttlMs);

        // Check for content deduplication
        const existingContent = await this.db
          .select({ id: htmlCache.id, urlHash: htmlCache.urlHash })
          .from(htmlCache)
          .where(eq(htmlCache.contentHash, page.contentHash))
          .limit(1);

        if (existingContent.length > 0 && existingContent[0].urlHash !== hash) {
          // Same content, different URL - create alias
          await this.db
            .insert(htmlCacheAliases)
            .values({
              aliasUrlHash: hash,
              canonicalId: existingContent[0].id,
            })
            .onConflictDoNothing();
          return;
        }

        // Insert or update the cache entry
        await this.db
          .insert(htmlCache)
          .values({
            urlHash: hash,
            url: page.etag ? `[hash:${hash}]` : `[hash:${hash}]`, // Placeholder URL
            contentHash: page.contentHash,
            htmlCompressed: compressedHtml,
            compressionAlgo: shouldCompress(page.html) ? "gzip" : "none",
            statusCode: page.statusCode,
            pageSizeBytes: page.pageSizeBytes,
            tierUsed: page.tierUsed,
            fetchedAt: page.fetchedAt,
            expiresAt,
            etag: page.etag,
            lastModified: page.lastModified,
            contentType: page.contentType,
            parsedData: page.parsedData,
          })
          .onConflictDoUpdate({
            target: htmlCache.urlHash,
            set: {
              contentHash: page.contentHash,
              htmlCompressed: compressedHtml,
              compressionAlgo: shouldCompress(page.html) ? "gzip" : "none",
              statusCode: page.statusCode,
              pageSizeBytes: page.pageSizeBytes,
              tierUsed: page.tierUsed,
              fetchedAt: page.fetchedAt,
              expiresAt,
              etag: page.etag,
              lastModified: page.lastModified,
              contentType: page.contentType,
              parsedData: page.parsedData,
            },
          });
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.debug("L3Cache set skipped - circuit open", { hash });
      } else {
        logger.error("L3Cache set error", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  async delete(hash: string): Promise<void> {
    try {
      // Delete aliases first
      await this.db
        .delete(htmlCacheAliases)
        .where(eq(htmlCacheAliases.aliasUrlHash, hash));

      // Then delete the main entry
      await this.db.delete(htmlCache).where(eq(htmlCache.urlHash, hash));
    } catch (error) {
      console.error("[L3Cache] Delete error:", error);
    }
  }

  async has(hash: string): Promise<boolean> {
    try {
      // Check aliases first
      const alias = await this.db
        .select({ canonicalId: htmlCacheAliases.canonicalId })
        .from(htmlCacheAliases)
        .where(eq(htmlCacheAliases.aliasUrlHash, hash))
        .limit(1);

      if (alias.length > 0) {
        // Verify canonical entry exists and is not expired
        const canonical = await this.db
          .select({ id: htmlCache.id })
          .from(htmlCache)
          .where(
            and(
              eq(htmlCache.id, alias[0].canonicalId),
              gt(htmlCache.expiresAt, new Date())
            )
          )
          .limit(1);
        return canonical.length > 0;
      }

      // Check direct entry
      const result = await this.db
        .select({ id: htmlCache.id })
        .from(htmlCache)
        .where(
          and(eq(htmlCache.urlHash, hash), gt(htmlCache.expiresAt, new Date()))
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      console.error("[L3Cache] Has error:", error);
      return false;
    }
  }

  getStats(): LevelStats {
    const total = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      avgLatencyMs:
        this.requestCount > 0 ? this.totalLatencyMs / this.requestCount : 0,
    };
  }

  async clear(): Promise<void> {
    try {
      await this.db.delete(htmlCacheAliases);
      await this.db.delete(htmlCache);
      this.resetStats();
    } catch (error) {
      console.error("[L3Cache] Clear error:", error);
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
   * Store a page with a known URL (not just hash).
   */
  async setWithUrl(
    hash: string,
    url: string,
    page: CachedPage,
    ttlMs: number
  ): Promise<void> {
    try {
      const compressedHtml = shouldCompress(page.html)
        ? compressToBase64(page.html)
        : page.html;

      const expiresAt = new Date(Date.now() + ttlMs);

      // Check for content deduplication
      const existingContent = await this.db
        .select({ id: htmlCache.id, urlHash: htmlCache.urlHash })
        .from(htmlCache)
        .where(eq(htmlCache.contentHash, page.contentHash))
        .limit(1);

      if (existingContent.length > 0 && existingContent[0].urlHash !== hash) {
        // Same content, different URL - create alias
        await this.db
          .insert(htmlCacheAliases)
          .values({
            aliasUrlHash: hash,
            canonicalId: existingContent[0].id,
          })
          .onConflictDoNothing();
        return;
      }

      // Insert or update
      await this.db
        .insert(htmlCache)
        .values({
          urlHash: hash,
          url,
          contentHash: page.contentHash,
          htmlCompressed: compressedHtml,
          compressionAlgo: shouldCompress(page.html) ? "gzip" : "none",
          statusCode: page.statusCode,
          pageSizeBytes: page.pageSizeBytes,
          tierUsed: page.tierUsed,
          fetchedAt: page.fetchedAt,
          expiresAt,
          etag: page.etag,
          lastModified: page.lastModified,
          contentType: page.contentType,
          parsedData: page.parsedData,
        })
        .onConflictDoUpdate({
          target: htmlCache.urlHash,
          set: {
            url,
            contentHash: page.contentHash,
            htmlCompressed: compressedHtml,
            compressionAlgo: shouldCompress(page.html) ? "gzip" : "none",
            statusCode: page.statusCode,
            pageSizeBytes: page.pageSizeBytes,
            tierUsed: page.tierUsed,
            fetchedAt: page.fetchedAt,
            expiresAt,
            etag: page.etag,
            lastModified: page.lastModified,
            contentType: page.contentType,
            parsedData: page.parsedData,
          },
        });
    } catch (error) {
      console.error("[L3Cache] SetWithUrl error:", error);
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

      // Fetch all matching rows
      const rows = await this.db
        .select()
        .from(htmlCache)
        .where(
          and(
            sql`${htmlCache.urlHash} IN ${hashes}`,
            gt(htmlCache.expiresAt, new Date())
          )
        );

      for (const row of rows) {
        this.hits++;
        results.set(row.urlHash, this.rowToCachedPage(row));
      }

      // Track misses
      const foundHashes = new Set(results.keys());
      for (const hash of hashes) {
        if (!foundHashes.has(hash)) {
          this.misses++;
        }
      }

      this.requestCount++;
    } catch (error) {
      console.error("[L3Cache] Mget error:", error);
    } finally {
      this.totalLatencyMs += performance.now() - startTime;
    }

    return results;
  }

  /**
   * Delete expired entries (maintenance job).
   */
  async deleteExpired(): Promise<number> {
    try {
      const result = await this.db
        .delete(htmlCache)
        .where(lt(htmlCache.expiresAt, new Date()));

      // Also clean up orphaned aliases
      await this.db.execute(sql`
        DELETE FROM html_cache_aliases
        WHERE canonical_id NOT IN (SELECT id FROM html_cache)
      `);

      return result.rowCount ?? 0;
    } catch (error) {
      console.error("[L3Cache] DeleteExpired error:", error);
      return 0;
    }
  }

  /**
   * Get storage statistics.
   */
  async getStorageStats(): Promise<{
    totalEntries: number;
    totalAliases: number;
    totalSizeBytes: number;
    avgSizeBytes: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    try {
      const entriesResult = await this.db
        .select({
          count: sql<number>`count(*)`,
          totalSize: sql<number>`sum(page_size_bytes)`,
          avgSize: sql<number>`avg(page_size_bytes)`,
          oldest: sql<Date>`min(fetched_at)`,
          newest: sql<Date>`max(fetched_at)`,
        })
        .from(htmlCache);

      const aliasesResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(htmlCacheAliases);

      return {
        totalEntries: entriesResult[0]?.count ?? 0,
        totalAliases: aliasesResult[0]?.count ?? 0,
        totalSizeBytes: entriesResult[0]?.totalSize ?? 0,
        avgSizeBytes: entriesResult[0]?.avgSize ?? 0,
        oldestEntry: entriesResult[0]?.oldest ?? null,
        newestEntry: entriesResult[0]?.newest ?? null,
      };
    } catch (error) {
      console.error("[L3Cache] GetStorageStats error:", error);
      return {
        totalEntries: 0,
        totalAliases: 0,
        totalSizeBytes: 0,
        avgSizeBytes: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Find entries by content hash (for deduplication analysis).
   */
  async findByContentHash(contentHash: string): Promise<string[]> {
    try {
      const results = await this.db
        .select({ urlHash: htmlCache.urlHash })
        .from(htmlCache)
        .where(eq(htmlCache.contentHash, contentHash));

      const aliases = await this.db
        .select({ aliasUrlHash: htmlCacheAliases.aliasUrlHash })
        .from(htmlCacheAliases)
        .innerJoin(htmlCache, eq(htmlCacheAliases.canonicalId, htmlCache.id))
        .where(eq(htmlCache.contentHash, contentHash));

      return [
        ...results.map((r) => r.urlHash),
        ...aliases.map((a) => a.aliasUrlHash),
      ];
    } catch (error) {
      console.error("[L3Cache] FindByContentHash error:", error);
      return [];
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Convert database row to CachedPage.
   */
  private rowToCachedPage(row: typeof htmlCache.$inferSelect): CachedPage {
    const html =
      row.compressionAlgo === "gzip"
        ? decompressFromBase64(row.htmlCompressed)
        : row.htmlCompressed;

    return {
      html,
      contentHash: row.contentHash,
      fetchedAt: row.fetchedAt,
      expiresAt: row.expiresAt,
      tierUsed: row.tierUsed as CachedPage["tierUsed"],
      statusCode: row.statusCode,
      pageSizeBytes: row.pageSizeBytes,
      etag: row.etag ?? undefined,
      lastModified: row.lastModified ?? undefined,
      contentType: row.contentType as CachedPage["contentType"],
      parsedData: row.parsedData ?? undefined,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new L3 cache instance.
 */
export function createL3Cache(
  db: PostgresJsDatabase,
  config?: Partial<L3CacheConfig>
): L3Cache {
  return new L3Cache(db, config);
}
