/**
 * L1 Memory LRU Cache
 * Phase 95-02: Multi-Level Caching
 *
 * In-memory LRU cache for hot pages with sub-millisecond access.
 * - Max size: 100MB (~1,000 pages at 100KB avg)
 * - Max items: 2,000 entries
 * - TTL: 5 minutes (default)
 * - Eviction: LRU (least recently used)
 */

import { LRUCache } from "lru-cache";
import type {
  CachedPage,
  CacheLevel,
  ICacheLevel,
  L1CacheConfig,
  LevelStats,
} from "./types";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: L1CacheConfig = {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  maxItems: 2000,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: true,
};

// =============================================================================
// L1Cache Implementation
// =============================================================================

/**
 * L1 Memory LRU Cache implementation.
 *
 * Uses lru-cache for efficient memory management with:
 * - Size-based eviction (tracks actual byte usage)
 * - TTL support with per-item expiration
 * - LRU eviction when size limit reached
 */
export class L1Cache implements ICacheLevel {
  readonly level: CacheLevel = "L1";

  private cache: LRUCache<string, CachedPage>;
  private config: L1CacheConfig;

  // Stats tracking
  private hits = 0;
  private misses = 0;
  private totalLatencyMs = 0;

  constructor(config: Partial<L1CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.cache = new LRUCache<string, CachedPage>({
      max: this.config.maxItems,
      maxSize: this.config.maxSizeBytes,
      ttl: this.config.defaultTtlMs,
      updateAgeOnGet: this.config.updateAgeOnGet,

      // Calculate size of each entry
      sizeCalculation: (value: CachedPage) => {
        return this.calculateSize(value);
      },

      // Optional: track evictions for debugging
      dispose: (_value, key, reason) => {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[L1Cache] Disposed ${key}: ${reason}`);
        }
      },
    });
  }

  // ===========================================================================
  // ICacheLevel Implementation
  // ===========================================================================

  async get(hash: string): Promise<CachedPage | null> {
    const startTime = performance.now();

    try {
      const key = this.makeKey(hash);
      const value = this.cache.get(key);

      if (value) {
        this.hits++;
        return value;
      }

      this.misses++;
      return null;
    } finally {
      this.totalLatencyMs += performance.now() - startTime;
    }
  }

  async set(hash: string, page: CachedPage, ttlMs?: number): Promise<void> {
    const key = this.makeKey(hash);

    this.cache.set(key, page, {
      ttl: ttlMs ?? this.config.defaultTtlMs,
    });
  }

  async delete(hash: string): Promise<void> {
    const key = this.makeKey(hash);
    this.cache.delete(key);
  }

  async has(hash: string): Promise<boolean> {
    const key = this.makeKey(hash);
    return this.cache.has(key);
  }

  getStats(): LevelStats {
    const total = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      avgLatencyMs: total > 0 ? this.totalLatencyMs / total : 0,
      sizeBytes: this.cache.calculatedSize,
      itemCount: this.cache.size,
    };
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStats();
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
  }

  /**
   * Get current cache size in bytes.
   */
  getCurrentSize(): number {
    return this.cache.calculatedSize ?? 0;
  }

  /**
   * Get current item count.
   */
  getItemCount(): number {
    return this.cache.size;
  }

  /**
   * Get remaining capacity in bytes.
   */
  getRemainingCapacity(): number {
    return this.config.maxSizeBytes - this.getCurrentSize();
  }

  /**
   * Check if cache is near capacity (>80% full).
   */
  isNearCapacity(): boolean {
    return this.getCurrentSize() > this.config.maxSizeBytes * 0.8;
  }

  /**
   * Get all cached keys (for debugging/testing).
   */
  getKeys(): string[] {
    return [...this.cache.keys()];
  }

  /**
   * Peek at a value without updating recency (for debugging).
   */
  peek(hash: string): CachedPage | undefined {
    const key = this.makeKey(hash);
    return this.cache.peek(key);
  }

  /**
   * Get TTL remaining for an item (in milliseconds).
   */
  getRemainingTtl(hash: string): number | undefined {
    const key = this.makeKey(hash);
    return this.cache.getRemainingTTL(key);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create cache key from hash.
   */
  private makeKey(hash: string): string {
    return `html:${hash}`;
  }

  /**
   * Calculate the byte size of a cached page.
   */
  private calculateSize(page: CachedPage): number {
    let size = 0;

    // HTML content (main contributor)
    size += page.html?.length ?? 0;

    // Content hash (16 chars)
    size += 16;

    // Metadata overhead (dates, numbers, strings)
    size += 200; // Base overhead for fields

    // Optional etag
    if (page.etag) {
      size += page.etag.length;
    }

    // Optional lastModified
    if (page.lastModified) {
      size += page.lastModified.length;
    }

    // Parsed data (if present)
    if (page.parsedData) {
      size += this.calculateParsedDataSize(page.parsedData);
    }

    return size;
  }

  /**
   * Calculate the byte size of parsed page data.
   */
  private calculateParsedDataSize(data: CachedPage["parsedData"]): number {
    if (!data) return 0;

    let size = 0;
    size += data.title?.length ?? 0;
    size += data.metaDescription?.length ?? 0;
    size += data.canonical?.length ?? 0;
    size += (data.h1?.join("") ?? "").length;
    size += (data.h2?.join("") ?? "").length;
    size += 100; // Numbers and boolean overhead

    return size;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new L1 cache instance with optional configuration.
 */
export function createL1Cache(config?: Partial<L1CacheConfig>): L1Cache {
  return new L1Cache(config);
}

// =============================================================================
// Singleton Instance
// =============================================================================

let l1CacheInstance: L1Cache | null = null;

/**
 * Get the singleton L1 cache instance.
 */
export function getL1Cache(): L1Cache {
  if (!l1CacheInstance) {
    l1CacheInstance = new L1Cache();
  }
  return l1CacheInstance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetL1CacheInstance(): void {
  if (l1CacheInstance) {
    l1CacheInstance.clear();
  }
  l1CacheInstance = null;
}
