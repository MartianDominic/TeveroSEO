/**
 * Bounded LRU cache with TTL support.
 * Thread-safe for server-side use.
 *
 * Prevents unbounded memory growth by evicting oldest entries
 * when capacity is reached.
 */
export class BoundedCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private maxSize: number;
  private defaultTTLMs: number;

  constructor(
    options: {
      maxSize?: number;
      defaultTTLMs?: number;
    } = {}
  ) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTLMs = options.defaultTTLMs ?? 5 * 60 * 1000; // 5 minutes
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

  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Singleton instances for common caches
export const apiResponseCache = new BoundedCache<string, unknown>({
  maxSize: 500,
  defaultTTLMs: 60 * 1000, // 1 minute
});

export const userProfileCache = new BoundedCache<string, unknown>({
  maxSize: 100,
  defaultTTLMs: 5 * 60 * 1000, // 5 minutes
});
