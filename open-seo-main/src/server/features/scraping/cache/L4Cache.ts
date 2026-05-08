/**
 * L4 Cloudflare R2 Archive Cache
 * Phase 95-02: Multi-Level Caching
 *
 * Long-term HTML archive storage using Cloudflare R2.
 * - TTL: 90 days (configurable via R2_RETENTION_DAYS env var)
 * - Compression: zstd/gzip
 * - Cost: $0.015/GB/mo + FREE egress
 *
 * ## R2 Bucket Lifecycle Configuration (Cloudflare Dashboard)
 *
 * To enforce 90-day retention at the storage level, configure a lifecycle rule
 * in the Cloudflare dashboard:
 *
 * 1. Go to R2 > Your Bucket > Settings > Lifecycle rules
 * 2. Add a rule with the following settings:
 *    - Rule name: "html-retention-90d"
 *    - Prefix filter: "html/" (applies to cached HTML only)
 *    - Action: Delete objects after 90 days
 *    - Enable the rule
 *
 * 3. For audit snapshots (longer retention), add a separate rule:
 *    - Rule name: "snapshot-retention-365d"
 *    - Prefix filter: "snapshots/"
 *    - Action: Delete objects after 365 days
 *
 * Note: Lifecycle rules are set via dashboard, not API. This module adds
 * x-cache-timestamp metadata and performs application-level age checks
 * as defense-in-depth alongside the lifecycle rules.
 *
 * Environment Variables:
 * - R2_RETENTION_DAYS: Override default 90-day retention (default: "90")
 * - R2_PURGE_RATE_LIMIT: Max purge operations per minute (default: "100")
 * - CF_ACCOUNT_ID: Cloudflare account ID for R2 endpoint
 * - R2_ACCESS_KEY_ID: R2 API access key
 * - R2_SECRET_ACCESS_KEY: R2 API secret key
 * - R2_BUCKET: Bucket name (default: "scrape-archive")
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type {
  CachedPage,
  CacheLevel,
  ICacheLevel,
  L4CacheConfig,
  LevelStats,
} from "./types";
import { compress, decompress } from "./compression";
import { cacheLogger } from "../logging";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: L4CacheConfig = {
  bucket: process.env.R2_BUCKET ?? "scrape-archive",
  retentionDays: parseInt(process.env.R2_RETENTION_DAYS ?? "90", 10),
  compressionAlgo: "zstd", // Using gzip as equivalent
  accountId: process.env.CF_ACCOUNT_ID ?? "",
};

/** Default purge rate limit (operations per minute) */
const DEFAULT_PURGE_RATE_LIMIT = parseInt(process.env.R2_PURGE_RATE_LIMIT ?? "100", 10);

/** Metadata key for cache timestamp (ISO 8601) */
const CACHE_TIMESTAMP_KEY = "x-cache-timestamp";

/** Metadata key for cache version (for future schema migrations) */
const CACHE_VERSION_KEY = "x-cache-version";

/** Current cache metadata version */
const CACHE_VERSION = "1";

// =============================================================================
// L4Cache Implementation
// =============================================================================

/**
 * L4 Cloudflare R2 Archive Cache implementation.
 *
 * Provides long-term HTML archival with:
 * - zstd/gzip compression for storage efficiency
 * - Object key structure: html/{year}/{month}/{day}/{hash}.html.gz
 * - Metadata sidecar files for fast lookups
 */
export class L4Cache implements ICacheLevel {
  readonly level: CacheLevel = "L4";

  private client: S3Client;
  private config: L4CacheConfig;

  // Stats tracking
  private hits = 0;
  private misses = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;

  // Purge rate limiting (sliding window)
  private purgeTimestamps: number[] = [];
  private purgeRateLimit: number;

  constructor(config: Partial<L4CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.purgeRateLimit = DEFAULT_PURGE_RATE_LIMIT;

    // Initialize S3 client for R2
    this.client = new S3Client({
      region: "auto",
      endpoint: this.config.accountId
        ? `https://${this.config.accountId}.r2.cloudflarestorage.com`
        : undefined,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  // ===========================================================================
  // ICacheLevel Implementation
  // ===========================================================================

  async get(hash: string): Promise<CachedPage | null> {
    const startTime = performance.now();
    this.requestCount++;

    try {
      // Try new hash-prefix key format first
      const key = this.getObjectKey(hash);
      let response = await this.tryGetObject(key);

      // Fallback to legacy date-based keys for backward compatibility
      // Check past 7 days to find entries stored with old key format
      if (!response) {
        response = await this.tryLegacyKeys(hash);
        if (response) {
          // Migrate entry to new key format (fire-and-forget)
          this.migrateToNewKey(hash, response).catch(() => {});
        }
      }

      if (!response || !response.Body) {
        this.misses++;
        return null;
      }

      // Read the body
      const bodyBytes = await response.Body.transformToByteArray();

      // Decompress and parse
      const html = decompress(bodyBytes);
      const metadata = this.parseMetadata(response.Metadata ?? {});

      const entry: CachedPage = {
        html,
        contentHash: metadata.contentHash ?? hash,
        fetchedAt: new Date(metadata.fetchedAt ?? Date.now()),
        expiresAt: new Date(metadata.expiresAt ?? Date.now() + 86400000),
        tierUsed: (metadata.tierUsed ?? "direct") as CachedPage["tierUsed"],
        statusCode: parseInt(metadata.statusCode ?? "200", 10),
        pageSizeBytes: parseInt(metadata.pageSizeBytes ?? "0", 10),
        etag: metadata.etag,
        lastModified: metadata.lastModified,
        contentType: metadata.contentType as CachedPage["contentType"],
      };

      // Check expiration before returning
      if (this.isExpired(entry)) {
        cacheLogger.debug(
          { hash, expiresAt: entry.expiresAt.toISOString() },
          "L4 cache entry expired"
        );
        // Fire-and-forget deletion of stale entry
        this.delete(hash).catch(() => {});
        this.misses++;
        return null;
      }

      // Defense-in-depth: Also check cache age based on x-cache-timestamp metadata
      // This catches entries that may have survived beyond retention period
      const cacheTimestamp = metadata[CACHE_TIMESTAMP_KEY] ?? metadata[CACHE_TIMESTAMP_KEY.toLowerCase()];
      if (cacheTimestamp) {
        const cacheDate = new Date(cacheTimestamp);
        const ageDays = Math.floor((Date.now() - cacheDate.getTime()) / (1000 * 60 * 60 * 24));

        if (ageDays >= this.config.retentionDays) {
          cacheLogger.debug(
            { hash, ageDays, retentionDays: this.config.retentionDays },
            "L4 cache entry exceeds retention period"
          );
          // Fire-and-forget deletion of stale entry
          this.delete(hash).catch(() => {});
          this.misses++;
          return null;
        }
      }

      this.hits++;
      return entry;
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        this.misses++;
        return null;
      }

      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache Get error:", error);
      this.misses++;
      return null;
    } finally {
      this.totalLatencyMs += performance.now() - startTime;
    }
  }

  /**
   * Try to get an object from R2, returns null on 404/not found.
   */
  private async tryGetObject(key: string): Promise<GetObjectCommandOutput | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });
      return await this.client.send(command);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Try legacy date-based keys for backward compatibility.
   * Checks past 7 days for entries stored with old format.
   */
  private async tryLegacyKeys(hash: string): Promise<GetObjectCommandOutput | null> {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Check past 7 days (most likely to have recent cached entries)
    for (let daysAgo = 0; daysAgo <= 7; daysAgo++) {
      const checkDate = new Date(now - daysAgo * dayMs);
      const legacyKey = this.getLegacyObjectKey(hash, checkDate);

      const response = await this.tryGetObject(legacyKey);
      if (response) {
        cacheLogger.debug(
          { hash, legacyKey, daysAgo },
          "Found entry with legacy date-based key"
        );
        return response;
      }
    }

    return null;
  }

  /**
   * Migrate an entry from legacy date-based key to new hash-prefix key.
   * Also deletes the old key after successful migration.
   */
  private async migrateToNewKey(
    hash: string,
    response: GetObjectCommandOutput
  ): Promise<void> {
    try {
      if (!response.Body) return;

      const bodyBytes = await response.Body.transformToByteArray();
      const newKey = this.getObjectKey(hash);

      // Copy to new key location
      const putCommand = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: newKey,
        Body: Buffer.from(bodyBytes),
        ContentType: response.ContentType,
        ContentEncoding: response.ContentEncoding,
        Metadata: response.Metadata,
      });

      await this.client.send(putCommand);

      cacheLogger.info(
        { hash, newKey },
        "Migrated L4 cache entry to new key format"
      );

      // Note: We don't delete the old key here because:
      // 1. We don't know which date it was stored under without checking again
      // 2. R2 lifecycle rules will clean up old entries
      // 3. Avoiding extra API calls for migration
    } catch (error) {
      cacheLogger.warn(
        { hash, error: error instanceof Error ? error.message : String(error) },
        "Failed to migrate L4 cache entry to new key format"
      );
    }
  }

  async set(hash: string, page: CachedPage, _ttlMs: number): Promise<void> {
    try {
      const key = this.getObjectKey(hash);

      // Compress the HTML
      const compressed = compress(page.html, { level: 6 });

      // Current timestamp for cache age tracking
      const cacheTimestamp = new Date().toISOString();

      // Prepare metadata with cache timestamp for retention tracking
      const metadata: Record<string, string> = {
        contentHash: page.contentHash,
        fetchedAt: page.fetchedAt.toISOString(),
        expiresAt: page.expiresAt.toISOString(),
        tierUsed: page.tierUsed,
        statusCode: String(page.statusCode),
        pageSizeBytes: String(page.pageSizeBytes),
        // Cache timestamp metadata for retention policy enforcement
        [CACHE_TIMESTAMP_KEY]: cacheTimestamp,
        [CACHE_VERSION_KEY]: CACHE_VERSION,
      };

      if (page.etag) metadata.etag = page.etag;
      if (page.lastModified) metadata.lastModified = page.lastModified;
      if (page.contentType) metadata.contentType = page.contentType;

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: Buffer.from(compressed.data),
        ContentType: "application/gzip",
        ContentEncoding: "gzip",
        Metadata: metadata,
      });

      await this.client.send(command);
    } catch (error) {
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache Set error:", error);
    }
  }

  async delete(hash: string): Promise<void> {
    try {
      const key = this.getObjectKey(hash);

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache Delete error:", error);
    }
  }

  async has(hash: string): Promise<boolean> {
    try {
      const key = this.getObjectKey(hash);

      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache Has error:", error);
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
    // Warning: This deletes ALL objects in the bucket!
    // Only use for testing.
    try {
      let continuationToken: string | undefined;

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.config.bucket,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const response = await this.client.send(listCommand);

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              await this.delete(obj.Key);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      this.resetStats();
    } catch (error) {
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache Clear error:", error);
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
   * Store an audit snapshot (collection of pages).
   */
  async storeAuditSnapshot(
    auditId: string,
    pages: Map<string, CachedPage>
  ): Promise<void> {
    try {
      // Create manifest
      const manifest = {
        auditId,
        createdAt: new Date().toISOString(),
        pageCount: pages.size,
        urls: Array.from(pages.keys()),
      };

      // Store manifest
      const manifestCommand = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: `snapshots/audit-${auditId}/manifest.json`,
        Body: JSON.stringify(manifest),
        ContentType: "application/json",
      });
      await this.client.send(manifestCommand);

      // Store each page
      for (const [hash, page] of pages) {
        const key = `snapshots/audit-${auditId}/pages/${hash}.html.gz`;
        const compressed = compress(page.html, { level: 6 });

        const pageCommand = new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: Buffer.from(compressed.data),
          ContentType: "application/gzip",
          ContentEncoding: "gzip",
          Metadata: {
            contentHash: page.contentHash,
            fetchedAt: page.fetchedAt.toISOString(),
            tierUsed: page.tierUsed,
          },
        });
        await this.client.send(pageCommand);
      }
    } catch (error) {
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache StoreAuditSnapshot error:", error);
    }
  }

  /**
   * Load audit snapshot manifest.
   */
  async getAuditSnapshotManifest(auditId: string): Promise<{
    auditId: string;
    createdAt: string;
    pageCount: number;
    urls: string[];
  } | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: `snapshots/audit-${auditId}/manifest.json`,
      });

      const response = await this.client.send(command);

      if (!response.Body) return null;

      const bodyStr = await response.Body.transformToString();
      return JSON.parse(bodyStr);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache GetAuditSnapshotManifest error:", error);
      return null;
    }
  }

  /**
   * List all stored hashes for a date.
   */
  async listByDate(date: Date): Promise<string[]> {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const prefix = `html/${year}/${month}/${day}/`;

      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        MaxKeys: 1000,
      });

      const response = await this.client.send(command);

      if (!response.Contents) return [];

      return response.Contents.filter((obj) => obj.Key)
        .map((obj) => {
          // Extract hash from key: html/2026/05/07/{hash}.html.gz
          const parts = obj.Key!.split("/");
          const filename = parts[parts.length - 1];
          return filename.replace(".html.gz", "");
        });
    } catch (error) {
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache ListByDate error:", error);
      return [];
    }
  }

  /**
   * Get bucket storage statistics.
   */
  async getStorageStats(): Promise<{
    totalObjects: number;
    totalSizeBytes: number;
  }> {
    try {
      let totalObjects = 0;
      let totalSizeBytes = 0;
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.config.bucket,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const response = await this.client.send(command);

        if (response.Contents) {
          for (const obj of response.Contents) {
            totalObjects++;
            totalSizeBytes += obj.Size ?? 0;
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return { totalObjects, totalSizeBytes };
    } catch (error) {
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache GetStorageStats error:", error);
      return { totalObjects: 0, totalSizeBytes: 0 };
    }
  }

  /**
   * Get cache age in days for a specific hash.
   * Returns null if the entry doesn't exist or has no timestamp metadata.
   */
  async getCacheAge(hash: string): Promise<number | null> {
    try {
      const key = this.getObjectKey(hash);

      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      const metadata = response.Metadata ?? {};

      // Check for cache timestamp in metadata
      const cacheTimestamp = metadata[CACHE_TIMESTAMP_KEY] ?? metadata[CACHE_TIMESTAMP_KEY.toLowerCase()];

      if (!cacheTimestamp) {
        // Fall back to fetchedAt if no cache timestamp
        const fetchedAt = metadata.fetchedat ?? metadata.fetchedAt;
        if (!fetchedAt) return null;

        const fetchedDate = new Date(fetchedAt);
        return Math.floor((Date.now() - fetchedDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      const cacheDate = new Date(cacheTimestamp);
      return Math.floor((Date.now() - cacheDate.getTime()) / (1000 * 60 * 60 * 24));
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      cacheLogger.error({ level: "L4", error: error instanceof Error ? error.message : String(error) }, "L4Cache GetCacheAge error:", error);
      return null;
    }
  }

  /**
   * Check if a cached entry is stale (older than retention period).
   * Uses the x-cache-timestamp metadata for accurate age calculation.
   *
   * @param hash - The cache key hash
   * @param maxAgeDays - Optional override for retention period (default: config.retentionDays)
   * @returns true if entry is stale or doesn't exist, false if fresh
   */
  async isStale(hash: string, maxAgeDays?: number): Promise<boolean> {
    const age = await this.getCacheAge(hash);

    if (age === null) {
      return true; // Treat missing entries as stale
    }

    const maxAge = maxAgeDays ?? this.config.retentionDays;
    return age >= maxAge;
  }

  /**
   * Purge a specific URL from the cache with rate limiting.
   *
   * Rate limiting prevents abuse and protects against accidental mass deletions.
   * Default limit: 100 purge operations per minute (configurable via R2_PURGE_RATE_LIMIT).
   *
   * @param hash - The cache key hash to purge
   * @returns Object with success status and optional error message
   */
  async purgeCache(hash: string): Promise<{ success: boolean; error?: string }> {
    // Rate limiting check (sliding window of 1 minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Clean up old timestamps
    this.purgeTimestamps = this.purgeTimestamps.filter((ts) => ts > oneMinuteAgo);

    // Check rate limit
    if (this.purgeTimestamps.length >= this.purgeRateLimit) {
      const error = `Purge rate limit exceeded (${this.purgeRateLimit}/min). Try again later.`;
      cacheLogger.warn({ hash, rateLimit: this.purgeRateLimit }, error);
      return { success: false, error };
    }

    try {
      // Record this purge operation
      this.purgeTimestamps.push(now);

      const key = this.getObjectKey(hash);

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);

      cacheLogger.info({ hash, key }, "Cache entry purged successfully");
      return { success: true };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cacheLogger.error({ level: "L4", hash, error: errorMessage }, "L4Cache Purge error");
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Bulk purge multiple cache entries with rate limiting.
   * Stops if rate limit is reached and returns partial results.
   *
   * @param hashes - Array of cache key hashes to purge
   * @returns Object with count of purged entries and any errors
   */
  async purgeCacheBulk(hashes: string[]): Promise<{
    purged: number;
    failed: number;
    rateLimited: boolean;
    errors: string[];
  }> {
    let purged = 0;
    let failed = 0;
    let rateLimited = false;
    const errors: string[] = [];

    for (const hash of hashes) {
      const result = await this.purgeCache(hash);

      if (result.success) {
        purged++;
      } else if (result.error?.includes("rate limit")) {
        rateLimited = true;
        break; // Stop processing on rate limit
      } else {
        failed++;
        if (result.error) {
          errors.push(`${hash}: ${result.error}`);
        }
      }
    }

    return { purged, failed, rateLimited, errors };
  }

  /**
   * Get the configured retention period in days.
   */
  getRetentionDays(): number {
    return this.config.retentionDays;
  }

  /**
   * Get the current purge rate limit status.
   */
  getPurgeRateLimitStatus(): {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: Date;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Clean up old timestamps
    this.purgeTimestamps = this.purgeTimestamps.filter((ts) => ts > oneMinuteAgo);

    const used = this.purgeTimestamps.length;
    const oldestTimestamp = this.purgeTimestamps[0];
    const resetsAt = oldestTimestamp
      ? new Date(oldestTimestamp + 60_000)
      : new Date(now);

    return {
      limit: this.purgeRateLimit,
      used,
      remaining: Math.max(0, this.purgeRateLimit - used),
      resetsAt,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Check if a cached entry has expired.
   */
  private isExpired(entry: CachedPage): boolean {
    return entry.expiresAt.getTime() < Date.now();
  }

  /**
   * Get object key for a hash.
   *
   * Format: html/{hash-prefix}/{hash}.html.gz
   *
   * Uses first 2 characters of hash as prefix for distribution across
   * virtual directories. This avoids date-based paths which cause cache
   * misses after midnight (the key would change daily).
   *
   * Note: The original fetch timestamp is stored in x-cache-timestamp
   * metadata for lifecycle rules and age calculations.
   */
  private getObjectKey(hash: string): string {
    // Use first 2 chars of hash as prefix for S3 distribution
    const prefix = hash.substring(0, 2);
    return `html/${prefix}/${hash}.html.gz`;
  }

  /**
   * Get legacy object key for migration/backward compatibility.
   * Tries to find entries stored with the old date-based key format.
   *
   * @param hash - The cache key hash
   * @param fetchDate - The date the content was originally fetched
   * @returns Legacy key in format html/{year}/{month}/{day}/{hash}.html.gz
   */
  private getLegacyObjectKey(hash: string, fetchDate: Date): string {
    const year = fetchDate.getFullYear();
    const month = String(fetchDate.getMonth() + 1).padStart(2, "0");
    const day = String(fetchDate.getDate()).padStart(2, "0");
    return `html/${year}/${month}/${day}/${hash}.html.gz`;
  }

  /**
   * Parse S3 object metadata to typed object.
   */
  private parseMetadata(metadata: Record<string, string>): Record<string, string | undefined> {
    // S3 lowercases metadata keys
    const normalized: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(metadata)) {
      normalized[key.toLowerCase()] = value;
      // Also try camelCase
      normalized[key] = value;
    }

    return normalized;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new L4 cache instance.
 */
export function createL4Cache(config?: Partial<L4CacheConfig>): L4Cache {
  return new L4Cache(config);
}
