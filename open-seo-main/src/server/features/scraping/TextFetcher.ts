/**
 * TextFetcher - Lightweight fetcher for text/XML files (robots.txt, sitemap.xml)
 * SEO-01: Migrate discovery.ts Direct Fetches to ScrapingService
 *
 * Purpose:
 * - Provides cached fetching for robots.txt and sitemap.xml
 * - Uses L2 Redis caching only (simpler than full ScrapingService)
 * - No tier escalation needed (these files are usually directly accessible)
 * - Consistent rate limiting and cost tracking
 *
 * TTL Strategy:
 * - robots.txt: 10 minutes (changes frequently with SEO updates)
 * - sitemap.xml: 2 hours (more stable, changes less often)
 */

import type { Redis } from "ioredis";
import { createLogger } from "@/server/lib/logger";
import { compressToBase64, decompressFromBase64, shouldCompress } from "./cache/compression";

const log = createLogger({ module: "text-fetcher" });

// =============================================================================
// Constants
// =============================================================================

/** Redis key prefix for text file cache */
const TEXT_CACHE_PREFIX = "textcache:";

/** TTL for robots.txt in seconds (10 minutes) */
const ROBOTS_TTL_SECONDS = 10 * 60;

/** TTL for sitemap.xml in seconds (2 hours) */
const SITEMAP_TTL_SECONDS = 2 * 60 * 60;

/** Default fetch timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 15_000;

/** User agent for text file requests */
const USER_AGENT = "OpenSEO-Audit/1.0";

// =============================================================================
// Types
// =============================================================================

/** Type of text file being fetched */
export type TextFileType = "robots" | "sitemap";

/** Options for text file fetch */
export interface TextFetchOptions {
  /** Fetch timeout in milliseconds (default: 15000) */
  timeoutMs?: number;

  /** Skip cache lookup and always fetch fresh */
  skipCache?: boolean;

  /** Custom headers to include */
  headers?: Record<string, string>;
}

/** Result of text file fetch */
export interface TextFetchResult {
  /** Whether fetch was successful */
  success: boolean;

  /** Text content (if successful) */
  content?: string;

  /** HTTP status code */
  statusCode: number;

  /** Whether result came from cache */
  fromCache: boolean;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Content size in bytes */
  contentSizeBytes: number;

  /** Error message (if failed) */
  error?: string;
}

/** Cached text data structure */
interface CachedText {
  content: string;
  compressed: boolean;
  fetchedAt: string;
  statusCode: number;
  contentSizeBytes: number;
}

// =============================================================================
// Serialization
// =============================================================================

function serializeText(content: string, statusCode: number): string {
  const compress = shouldCompress(content);
  const cached: CachedText = {
    content: compress ? compressToBase64(content) : content,
    compressed: compress,
    fetchedAt: new Date().toISOString(),
    statusCode,
    contentSizeBytes: Buffer.byteLength(content, "utf8"),
  };
  return JSON.stringify(cached);
}

function deserializeText(data: string): CachedText | null {
  try {
    const cached: CachedText = JSON.parse(data);
    if (cached.compressed) {
      cached.content = decompressFromBase64(cached.content);
    }
    return cached;
  } catch {
    return null;
  }
}

// =============================================================================
// TextFetcher Class
// =============================================================================

/**
 * Lightweight fetcher for text/XML files with L2 Redis caching.
 *
 * Unlike ScrapingService which handles full HTML pages with tier escalation,
 * TextFetcher is optimized for simple text files that don't need proxies.
 */
export class TextFetcher {
  private redis: Redis | null = null;

  // Stats tracking
  private totalRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private failures = 0;

  /**
   * Initialize with Redis connection for caching.
   * Call this once during application startup.
   */
  initialize(redis: Redis): void {
    this.redis = redis;
    log.info("TextFetcher initialized with Redis caching");
  }

  /**
   * Check if the fetcher is initialized.
   */
  isInitialized(): boolean {
    return this.redis !== null;
  }

  /**
   * Fetch robots.txt with caching.
   */
  async fetchRobotsTxt(
    origin: string,
    options: TextFetchOptions = {}
  ): Promise<TextFetchResult> {
    const url = `${origin}/robots.txt`;
    return this.fetchText(url, "robots", options);
  }

  /**
   * Fetch sitemap.xml with caching.
   */
  async fetchSitemapXml(
    url: string,
    options: TextFetchOptions = {}
  ): Promise<TextFetchResult> {
    return this.fetchText(url, "sitemap", options);
  }

  /**
   * Core fetch method with caching logic.
   */
  async fetchText(
    url: string,
    type: TextFileType,
    options: TextFetchOptions = {}
  ): Promise<TextFetchResult> {
    const startTime = Date.now();
    this.totalRequests++;

    // Check cache first (unless skipCache is true)
    if (!options.skipCache && this.redis) {
      const cached = await this.getFromCache(url, type);
      if (cached) {
        this.cacheHits++;
        return {
          success: true,
          content: cached.content,
          statusCode: cached.statusCode,
          fromCache: true,
          responseTimeMs: Date.now() - startTime,
          contentSizeBytes: cached.contentSizeBytes,
        };
      }
    }

    this.cacheMisses++;

    // Fetch from network
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const responseTimeMs = Date.now() - startTime;
      const statusCode = response.status;

      if (!response.ok) {
        // 404 is expected for missing robots.txt/sitemap - cache this result
        if (statusCode === 404) {
          log.debug(`File not found (404): ${url} [${type}]`);
          return {
            success: false,
            statusCode,
            fromCache: false,
            responseTimeMs,
            contentSizeBytes: 0,
            error: "Not found",
          };
        }

        this.failures++;
        log.warn(`Fetch failed with non-OK status: ${url} [${type}] status=${statusCode}`);
        return {
          success: false,
          statusCode,
          fromCache: false,
          responseTimeMs,
          contentSizeBytes: 0,
          error: `HTTP ${statusCode}`,
        };
      }

      const content = await response.text();
      const contentSizeBytes = Buffer.byteLength(content, "utf8");

      // Store in cache
      if (this.redis) {
        await this.setInCache(url, type, content, statusCode);
      }

      log.debug(`Fetch successful: ${url} [${type}] size=${contentSizeBytes} time=${responseTimeMs}ms`);

      return {
        success: true,
        content,
        statusCode,
        fromCache: false,
        responseTimeMs,
        contentSizeBytes,
      };
    } catch (error) {
      this.failures++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof Error && error.name === "TimeoutError";

      log.warn(`Fetch error: ${url} [${type}] error=${errorMessage} timeout=${isTimeout}`);

      return {
        success: false,
        statusCode: 0,
        fromCache: false,
        responseTimeMs: Date.now() - startTime,
        contentSizeBytes: 0,
        error: isTimeout ? "Timeout" : errorMessage,
      };
    }
  }

  /**
   * Get text from Redis cache.
   */
  private async getFromCache(
    url: string,
    type: TextFileType
  ): Promise<CachedText | null> {
    if (!this.redis) return null;

    try {
      const key = this.getCacheKey(url, type);
      const data = await this.redis.get(key);

      if (!data) return null;

      return deserializeText(data);
    } catch (error) {
      log.error(`Cache get error: ${url} [${type}]`, error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Store text in Redis cache with appropriate TTL.
   */
  private async setInCache(
    url: string,
    type: TextFileType,
    content: string,
    statusCode: number
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const key = this.getCacheKey(url, type);
      const ttl = type === "robots" ? ROBOTS_TTL_SECONDS : SITEMAP_TTL_SECONDS;
      const data = serializeText(content, statusCode);

      await this.redis.setex(key, ttl, data);
    } catch (error) {
      log.error(`Cache set error: ${url} [${type}]`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Generate cache key for a URL and type.
   */
  private getCacheKey(url: string, type: TextFileType): string {
    // Use simple hash for URL to create consistent key
    const urlHash = this.hashUrl(url);
    return `${TEXT_CACHE_PREFIX}${type}:${urlHash}`;
  }

  /**
   * Simple hash function for URL to cache key.
   */
  private hashUrl(url: string): string {
    // Simple djb2 hash for URL -> 8 char hex
    let hash = 5381;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  /**
   * Invalidate cache for a specific URL.
   */
  async invalidate(url: string, type: TextFileType): Promise<void> {
    if (!this.redis) return;

    try {
      const key = this.getCacheKey(url, type);
      await this.redis.del(key);
      log.debug(`Cache invalidated: ${url} [${type}]`);
    } catch (error) {
      log.error(`Cache invalidate error: ${url} [${type}]`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Invalidate all cached text files for a domain.
   */
  async invalidateDomain(domain: string): Promise<void> {
    if (!this.redis) return;

    try {
      // Invalidate both robots.txt and sitemap.xml for this domain
      const robotsUrl = `https://${domain}/robots.txt`;
      const sitemapUrl = `https://${domain}/sitemap.xml`;

      await Promise.all([
        this.invalidate(robotsUrl, "robots"),
        this.invalidate(sitemapUrl, "sitemap"),
      ]);

      log.debug(`Domain cache invalidated: ${domain}`);
    } catch (error) {
      log.error(`Domain invalidate error: ${domain}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get fetch statistics.
   */
  getStats(): {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    failures: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      failures: this.failures,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.totalRequests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.failures = 0;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/** Singleton TextFetcher instance */
export const textFetcher = new TextFetcher();

/**
 * Create a new TextFetcher instance (for testing or isolated use).
 */
export function createTextFetcher(): TextFetcher {
  return new TextFetcher();
}
