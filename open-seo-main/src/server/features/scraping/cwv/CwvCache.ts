/**
 * CwvCache - Core Web Vitals Cache Layer
 * Phase 95-07: Core Web Vitals Integration
 *
 * Redis-backed caching for CWV data with source-appropriate TTLs.
 * Origin-level caching for CrUX data, URL-level for PSI data.
 *
 * Features:
 * - Origin-level keys for CrUX (24h TTL)
 * - URL-level keys for PSI (1h TTL)
 * - Batch operations (mget)
 * - SHA-256 hashing for cache keys
 */

import type { Redis } from 'ioredis';
import type { CwvMetrics } from './types';
import { getCacheKey } from '../cache/urlNormalization';

// =============================================================================
// Types
// =============================================================================

export interface CwvCacheConfig {
  redis: Redis;
  cruxTtl?: number; // seconds, default 24 hours
  psiTtl?: number; // seconds, default 1 hour
}

// =============================================================================
// CwvCache
// =============================================================================

export class CwvCache {
  private readonly redis: Redis;
  private readonly cruxTtl: number;
  private readonly psiTtl: number;

  constructor(config: CwvCacheConfig) {
    if (!config.redis) {
      throw new Error('Redis instance is required');
    }

    this.redis = config.redis;
    this.cruxTtl = config.cruxTtl ?? 24 * 60 * 60; // 24 hours
    this.psiTtl = config.psiTtl ?? 60 * 60; // 1 hour
  }

  /**
   * Get cached CWV data for a URL.
   * Tries origin-level cache first, then URL-level.
   */
  async get(url: string): Promise<CwvMetrics | null> {
    const origin = this.extractOrigin(url);

    // Try origin-level cache first (CrUX data)
    const originKey = this.originKey(origin);
    const originData = await this.redis.get(originKey);

    if (originData) {
      return this.deserialize(originData);
    }

    // Try URL-level cache (PSI data)
    const urlKey = this.urlKey(url);
    const urlData = await this.redis.get(urlKey);

    if (urlData) {
      return this.deserialize(urlData);
    }

    return null;
  }

  /**
   * Store CWV data with source-appropriate TTL.
   */
  async set(url: string, metrics: CwvMetrics): Promise<void> {
    const serialized = this.serialize(metrics);

    if (metrics.source === 'crux') {
      // Store at origin level with 24h TTL
      const origin = this.extractOrigin(url);
      const key = this.originKey(origin);
      await this.redis.setex(key, this.cruxTtl, serialized);
    } else if (metrics.source === 'psi') {
      // Store at URL level with 1h TTL
      const key = this.urlKey(url);
      await this.redis.setex(key, this.psiTtl, serialized);
    }
    // 'unavailable' is not cached
  }

  /**
   * Batch get for multiple URLs.
   */
  async mget(urls: string[]): Promise<Map<string, CwvMetrics>> {
    const result = new Map<string, CwvMetrics>();

    if (urls.length === 0) {
      return result;
    }

    // Group by origin for origin-level cache lookup
    const originMap = new Map<string, string[]>();
    for (const url of urls) {
      const origin = this.extractOrigin(url);
      if (!originMap.has(origin)) {
        originMap.set(origin, []);
      }
      originMap.get(origin)!.push(url);
    }

    // Fetch origin-level data
    const originKeys = Array.from(originMap.keys()).map((origin) => this.originKey(origin));
    const originData = await this.redis.mget(...originKeys);

    // Map origin data to URLs
    const origins = Array.from(originMap.keys());
    for (let i = 0; i < origins.length; i++) {
      const data = originData[i];
      if (data) {
        const metrics = this.deserialize(data);
        const urlsForOrigin = originMap.get(origins[i])!;
        for (const url of urlsForOrigin) {
          result.set(url, metrics);
        }
      }
    }

    // For URLs not found at origin level, try URL-level cache
    const missingUrls = urls.filter((url) => !result.has(url));
    if (missingUrls.length > 0) {
      const urlKeys = missingUrls.map((url) => this.urlKey(url));
      const urlData = await this.redis.mget(...urlKeys);

      for (let i = 0; i < missingUrls.length; i++) {
        const data = urlData[i];
        if (data) {
          result.set(missingUrls[i], this.deserialize(data));
        }
      }
    }

    return result;
  }

  /**
   * Invalidate cache for a URL (both origin and URL level).
   */
  async invalidate(url: string): Promise<void> {
    const origin = this.extractOrigin(url);
    const originKey = this.originKey(origin);
    const urlKey = this.urlKey(url);

    await Promise.all([this.redis.del(originKey), this.redis.del(urlKey)]);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private originKey(origin: string): string {
    return `cwv:origin:${origin}`;
  }

  private urlKey(url: string): string {
    // Use centralized hashing utility (SHA-256/16)
    // Note: Raw URL is used intentionally - CWV metrics can differ by query params
    const hash = getCacheKey(url);
    return `cwv:url:${hash}`;
  }

  private extractOrigin(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.origin;
    } catch {
      return url;
    }
  }

  private serialize(metrics: CwvMetrics): string {
    return JSON.stringify({
      ...metrics,
      fetchedAt: metrics.fetchedAt.toISOString(),
    });
  }

  private deserialize(data: string): CwvMetrics {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      fetchedAt: new Date(parsed.fetchedAt),
    };
  }
}
