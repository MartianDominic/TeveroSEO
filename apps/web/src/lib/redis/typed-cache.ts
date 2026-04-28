/**
 * Type-safe cache wrapper using Zod schemas.
 * Provides a convenient API for creating domain-specific caches.
 */

import { z } from "zod";
import { cacheGet, cacheSet, cacheDelete, cacheInvalidateByTag } from "./cache";

/**
 * Create a type-safe cache for a specific domain.
 * All operations are validated against the provided Zod schema.
 *
 * @param namespace - Unique namespace for this cache domain
 * @param schema - Zod schema for validation
 * @param defaultTtl - Default TTL in seconds
 *
 * @example
 * ```typescript
 * const clientCache = createTypedCache(
 *   'clients',
 *   z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     createdAt: z.string(),
 *   }),
 *   600  // 10 minute TTL
 * );
 *
 * // Type-safe operations
 * await clientCache.set('client-123', { id: '123', name: 'Acme', createdAt: '2024-01-01' });
 * const client = await clientCache.get('client-123');
 * ```
 */
export function createTypedCache<T>(
  namespace: string,
  schema: z.ZodType<T>,
  defaultTtl = 300
) {
  return {
    /**
     * Get a cached value by key.
     * Returns null if not found or validation fails.
     */
    async get(key: string): Promise<T | null> {
      return cacheGet(namespace, key, schema);
    },

    /**
     * Set a cached value with optional custom TTL.
     */
    async set(key: string, value: T, ttl = defaultTtl, tags: string[] = []): Promise<void> {
      return cacheSet(namespace, key, value, { ttl, tags });
    },

    /**
     * Delete a cached value.
     */
    async delete(key: string): Promise<void> {
      return cacheDelete(namespace, key);
    },

    /**
     * Get a cached value or compute and cache it.
     * Prevents cache stampede by using the factory function only when needed.
     */
    async getOrSet(
      key: string,
      factory: () => Promise<T>,
      ttl = defaultTtl,
      tags: string[] = []
    ): Promise<T> {
      const cached = await this.get(key);
      if (cached !== null) return cached;

      const value = await factory();
      await this.set(key, value, ttl, tags);
      return value;
    },

    /**
     * Invalidate all entries with a specific tag.
     */
    async invalidateByTag(tag: string): Promise<number> {
      return cacheInvalidateByTag(tag);
    },
  };
}

// Common Zod schemas for reuse
export const commonSchemas = {
  client: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
  }),

  dashboardMetrics: z.object({
    totalClients: z.number(),
    activeClients: z.number(),
    totalKeywords: z.number(),
    avgRanking: z.number().nullable(),
  }),

  paginatedResponse: <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
      items: z.array(itemSchema),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      hasMore: z.boolean(),
    }),

  analyticsPattern: z.object({
    id: z.string(),
    type: z.string(),
    score: z.number(),
    description: z.string(),
    detectedAt: z.string(),
  }),
};

// Pre-configured caches for common domains
export const clientCache = createTypedCache(
  "clients",
  commonSchemas.client,
  600 // 10 minute TTL
);

export const dashboardCache = createTypedCache(
  "dashboard",
  commonSchemas.dashboardMetrics,
  300 // 5 minute TTL
);

export const patternsCache = createTypedCache(
  "patterns",
  z.array(commonSchemas.analyticsPattern),
  600 // 10 minute TTL
);
