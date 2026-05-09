/**
 * BoundedCache - Unified LRU Cache with TTL
 *
 * Consolidated cache implementation for the TeveroSEO monorepo.
 * Thread-safe for server-side use with bounded memory growth.
 *
 * Features:
 * - LRU eviction when capacity is reached
 * - TTL-based expiration
 * - Pattern-based invalidation (glob matching)
 * - Automatic pruning of expired entries
 *
 * @example
 * ```ts
 * import { BoundedCache, createBoundedCache } from '@tevero/utils/bounded-cache';
 *
 * const cache = createBoundedCache<string, User>({
 *   maxSize: 100,
 *   defaultTTLMs: 5 * 60 * 1000, // 5 minutes
 *   name: 'users',
 * });
 *
 * cache.set('user:123', user);
 * const cached = cache.get('user:123');
 * cache.clearPattern('user:*'); // Clear all user entries
 * ```
 */

export interface BoundedCacheOptions {
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTTLMs?: number;
  /** Cache name for metrics and debugging */
  name?: string;
}

export interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  name: string;
}

/**
 * Bounded LRU cache with TTL support.
 *
 * Prevents unbounded memory growth by evicting oldest entries
 * when capacity is reached. Uses Map's insertion order for LRU.
 */
export class BoundedCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly defaultTTLMs: number;
  private readonly name: string;

  constructor(options: BoundedCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTLMs = options.defaultTTLMs ?? 5 * 60 * 1000;
    this.name = options.name ?? 'unnamed';
  }

  /**
   * Get the cache name.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get a cached value by key.
   * Returns undefined if not found or expired.
   * Updates LRU position on hit.
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a cached value with optional TTL.
   * Evicts oldest entries if at capacity.
   */
  set(key: K, value: V, ttlMs?: number): void {
    // Delete existing to update position
    this.cache.delete(key);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTLMs),
    });
  }

  /**
   * Delete a cached entry by key.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries.
   * Call periodically in long-running processes.
   * @returns Number of entries pruned
   */
  prune(): number {
    const now = Date.now();
    const keysToDelete: K[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Get current cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics.
   */
  stats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      name: this.name,
    };
  }

  /**
   * Clear entries matching a glob pattern.
   * Uses simple glob matching (* matches any characters).
   *
   * @param pattern - Glob pattern with * wildcards
   * @returns Number of entries cleared
   *
   * @example
   * cache.clearPattern("client:123:*") // Clears all client-123 entries
   * cache.clearPattern("*:analytics:*") // Clears all analytics entries
   */
  clearPattern(pattern: string): number {
    if (typeof pattern !== 'string') return 0;

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);

    const keysToDelete: K[] = [];
    this.cache.forEach((_, key) => {
      if (typeof key === 'string' && regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get all valid keys (excluding expired).
   */
  keys(): K[] {
    const now = Date.now();
    const validKeys: K[] = [];
    this.cache.forEach((entry, key) => {
      if (now <= entry.expiresAt) {
        validKeys.push(key);
      }
    });
    return validKeys;
  }

  /**
   * Get all valid entries (excluding expired).
   */
  entries(): Array<[K, V]> {
    const now = Date.now();
    const validEntries: Array<[K, V]> = [];
    this.cache.forEach((entry, key) => {
      if (now <= entry.expiresAt) {
        validEntries.push([key, entry.value]);
      }
    });
    return validEntries;
  }

  /**
   * Get or set a cached value.
   * If the key doesn't exist, the factory function is called
   * and the result is cached.
   */
  async getOrSet(
    key: K,
    factory: () => Promise<V> | V,
    ttlMs?: number
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
}

/**
 * Factory function to create a new BoundedCache instance.
 */
export function createBoundedCache<K, V>(
  options?: BoundedCacheOptions
): BoundedCache<K, V> {
  return new BoundedCache<K, V>(options);
}

// =============================================================================
// Pruning Utilities
// =============================================================================

/**
 * Start periodic pruning for a cache.
 * Returns a cleanup function to stop pruning.
 *
 * @param cache - The BoundedCache instance to prune
 * @param intervalMs - Pruning interval in milliseconds (default: 5 minutes)
 * @returns Cleanup function to stop pruning
 */
export function startPeriodicPruning<K, V>(
  cache: BoundedCache<K, V>,
  intervalMs: number = 5 * 60 * 1000
): () => void {
  const interval = setInterval(() => {
    cache.prune();
  }, intervalMs);

  // Don't keep the process alive just for cleanup
  if (interval.unref) {
    interval.unref();
  }

  return () => clearInterval(interval);
}

// =============================================================================
// Pre-configured Cache Factories
// =============================================================================

/**
 * Create an API response cache with sensible defaults.
 * 500 entries, 1 minute TTL.
 */
export function createApiResponseCache<V = unknown>(): BoundedCache<string, V> {
  return createBoundedCache<string, V>({
    maxSize: 500,
    defaultTTLMs: 60 * 1000, // 1 minute
    name: 'apiResponse',
  });
}

/**
 * Create a user profile cache with sensible defaults.
 * 100 entries, 5 minutes TTL.
 */
export function createUserProfileCache<V = unknown>(): BoundedCache<string, V> {
  return createBoundedCache<string, V>({
    maxSize: 100,
    defaultTTLMs: 5 * 60 * 1000, // 5 minutes
    name: 'userProfile',
  });
}

/**
 * Create a SERP cache with sensible defaults.
 * 500 entries, 1 hour TTL.
 */
export function createSerpMemoryCache<V = unknown>(): BoundedCache<string, V> {
  return createBoundedCache<string, V>({
    maxSize: 500,
    defaultTTLMs: 60 * 60 * 1000, // 1 hour
    name: 'serp',
  });
}
