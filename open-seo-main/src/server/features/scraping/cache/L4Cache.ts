/**
 * L4 Cloudflare R2 Archive Cache
 * Phase 95-02: Multi-Level Caching
 *
 * Long-term HTML archive storage using Cloudflare R2.
 * - TTL: 90 days (configurable)
 * - Compression: zstd/gzip
 * - Cost: $0.015/GB/mo + FREE egress
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type {
  CachedPage,
  CacheLevel,
  ICacheLevel,
  L4CacheConfig,
  LevelStats,
} from "./types";
import { compress, decompress } from "./compression";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: L4CacheConfig = {
  bucket: "scrape-archive",
  retentionDays: 90,
  compressionAlgo: "zstd", // Using gzip as equivalent
  accountId: process.env.CF_ACCOUNT_ID ?? "",
};

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

  constructor(config: Partial<L4CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

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
      const key = this.getObjectKey(hash);

      // Get the object
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        this.misses++;
        return null;
      }

      // Read the body
      const bodyBytes = await response.Body.transformToByteArray();

      // Decompress and parse
      const html = decompress(bodyBytes);
      const metadata = this.parseMetadata(response.Metadata ?? {});

      this.hits++;
      return {
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
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        this.misses++;
        return null;
      }

      console.error("[L4Cache] Get error:", error);
      this.misses++;
      return null;
    } finally {
      this.totalLatencyMs += performance.now() - startTime;
    }
  }

  async set(hash: string, page: CachedPage, ttlMs: number): Promise<void> {
    try {
      const key = this.getObjectKey(hash);

      // Compress the HTML
      const compressed = compress(page.html, { level: 6 });

      // Prepare metadata
      const metadata: Record<string, string> = {
        contentHash: page.contentHash,
        fetchedAt: page.fetchedAt.toISOString(),
        expiresAt: page.expiresAt.toISOString(),
        tierUsed: page.tierUsed,
        statusCode: String(page.statusCode),
        pageSizeBytes: String(page.pageSizeBytes),
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
      console.error("[L4Cache] Set error:", error);
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
      console.error("[L4Cache] Delete error:", error);
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
      console.error("[L4Cache] Has error:", error);
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
      console.error("[L4Cache] Clear error:", error);
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
      console.error("[L4Cache] StoreAuditSnapshot error:", error);
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
      console.error("[L4Cache] GetAuditSnapshotManifest error:", error);
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
      console.error("[L4Cache] ListByDate error:", error);
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
      console.error("[L4Cache] GetStorageStats error:", error);
      return { totalObjects: 0, totalSizeBytes: 0 };
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get object key for a hash.
   *
   * Format: html/{year}/{month}/{day}/{hash}.html.gz
   */
  private getObjectKey(hash: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

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
