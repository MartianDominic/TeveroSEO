/**
 * Bounded LRU cache with TTL support.
 * Thread-safe for server-side use.
 *
 * Prevents unbounded memory growth by evicting oldest entries
 * when capacity is reached. Used for in-memory caching where
 * Redis is not appropriate (e.g., short-lived request caches).
 *
 * HIGH-CACHE-02 FIX: Added pattern-based invalidation support.
 * MED-CACHE-02 FIX: LRU eviction built-in for bounded size.
 */
export class BoundedCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private maxSize: number;
  private defaultTTLMs: number;
  private name: string;

  constructor(
    options: {
      maxSize?: number;
      defaultTTLMs?: number;
      /** Cache name for metrics and debugging */
      name?: string;
    } = {}
  ) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTLMs = options.defaultTTLMs ?? 5 * 60 * 1000; // 5 minutes
    this.name = options.name ?? "unnamed";
  }

  /**
   * Get the cache name.
   */
  getName(): string {
    return this.name;
  }

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

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries.
   * Call periodically in long-running processes.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    const keysToDelete: K[] = [];

    // Collect expired keys first to avoid mutation during iteration
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    // Delete expired entries
    for (const key of keysToDelete) {
      this.cache.delete(key);
      pruned++;
    }

    return pruned;
  }

  get size(): number {
    return this.cache.size;
  }

  stats(): { size: number; maxSize: number; name: string } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      name: this.name,
    };
  }

  /**
   * HIGH-CACHE-02 FIX: Clear entries matching a glob pattern.
   * Uses simple glob matching (* matches any characters).
   *
   * @param pattern - Glob pattern with * wildcards
   * @returns Number of entries cleared
   *
   * @example
   * cache.clearPattern("serp:client-123:*") // Clears all client-123 SERP entries
   */
  clearPattern(pattern: string): number {
    if (typeof pattern !== "string") return 0;

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
      .replace(/\*/g, ".*"); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);

    const keysToDelete: K[] = [];
    this.cache.forEach((_, key) => {
      if (typeof key === "string" && regex.test(key)) {
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
   * Get all keys (excluding expired).
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
}
