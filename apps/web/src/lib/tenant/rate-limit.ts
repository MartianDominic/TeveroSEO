/**
 * Per-Tenant Rate Limiting Module
 * Provides rate limiting scoped to individual clients/workspaces.
 *
 * Features:
 * 1. Per-client rate limits (separate from global limits)
 * 2. Configurable limits per operation type
 * 3. Graceful degradation when Redis is unavailable
 * 4. Rate limit header generation for API responses
 */

import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis/client";

import { getTenantContextOrNull } from "./context";

// --- Types ---

export interface TenantRateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Operation category for the rate limit */
  category: TenantRateLimitCategory;
  /** Whether to fail closed (reject) on Redis errors */
  failClosed?: boolean;
}

export interface TenantRateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
  /** Total limit for this window */
  limit: number;
  /** Client ID the limit applies to */
  clientId?: string;
  /** Workspace ID the limit applies to */
  workspaceId: string;
}

/**
 * Rate limit categories with default configurations.
 */
export type TenantRateLimitCategory =
  | "chat"
  | "content_generation"
  | "seo_audit"
  | "api_call"
  | "export"
  | "bulk_operation";

// --- Default Configurations ---

/**
 * Default rate limits per category (per client per hour).
 * These can be overridden per workspace via configuration.
 */
export const DEFAULT_TENANT_LIMITS: Record<
  TenantRateLimitCategory,
  { maxRequests: number; windowSeconds: number }
> = {
  // Chat messages: 100 per minute per client
  chat: { maxRequests: 100, windowSeconds: 60 },
  // Content generation: 50 per hour per client (expensive LLM calls)
  content_generation: { maxRequests: 50, windowSeconds: 3600 },
  // SEO audits: 5 per hour per client (very expensive)
  seo_audit: { maxRequests: 5, windowSeconds: 3600 },
  // External API calls: 200 per hour per client
  api_call: { maxRequests: 200, windowSeconds: 3600 },
  // Exports: 20 per hour per client
  export: { maxRequests: 20, windowSeconds: 3600 },
  // Bulk operations: 10 per hour per client
  bulk_operation: { maxRequests: 10, windowSeconds: 3600 },
};

// --- Redis Key Generation ---

/**
 * Generate Redis key for tenant rate limiting.
 * Format: tenant:ratelimit:{workspaceId}:{clientId?}:{category}
 */
function getTenantRateLimitKey(
  workspaceId: string,
  clientId: string | undefined,
  category: TenantRateLimitCategory
): string {
  const scope = clientId || "workspace";
  return `tenant:ratelimit:${workspaceId}:${scope}:${category}`;
}

// --- Core Rate Limiting ---

/**
 * Check and record a rate-limited operation for a tenant.
 * Uses sliding window algorithm with Redis sorted sets.
 *
 * @param workspaceId - Workspace to rate limit
 * @param clientId - Optional client ID for client-scoped limits
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkTenantRateLimit(
  workspaceId: string,
  clientId: string | undefined,
  config: TenantRateLimitConfig
): Promise<TenantRateLimitResult> {
  const { maxRequests, windowSeconds, category, failClosed = false } = config;
  const key = getTenantRateLimitKey(workspaceId, clientId, category);
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Use Redis transaction for atomic operations
    const pipeline = redis.pipeline();

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    pipeline.zcard(key);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    // Check if over limit
    if (currentCount >= maxRequests) {
      // Get oldest entry for reset time calculation
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTimestamp = oldest?.[1] ? parseInt(oldest[1], 10) : now;
      const resetAt = oldestTimestamp + windowSeconds * 1000;

      logger.info("[tenant-rate-limit] Rate limit reached", {
        workspaceId,
        clientId,
        category,
        currentCount,
        maxRequests,
      });

      return {
        success: false,
        remaining: 0,
        resetAt,
        limit: maxRequests,
        clientId,
        workspaceId,
      };
    }

    // Add current request to the window
    await redis.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry on the key (window + buffer)
    await redis.expire(key, windowSeconds + 60);

    return {
      success: true,
      remaining: maxRequests - currentCount - 1,
      resetAt: now + windowSeconds * 1000,
      limit: maxRequests,
      clientId,
      workspaceId,
    };
  } catch (error) {
    logger.error(
      "[tenant-rate-limit] Redis error",
      error instanceof Error ? error : { error: String(error) }
    );

    if (failClosed) {
      // For expensive operations, reject on Redis errors
      return {
        success: false,
        remaining: 0,
        resetAt: now + 60000, // Suggest retry in 1 minute
        limit: maxRequests,
        clientId,
        workspaceId,
      };
    }

    // For non-critical operations, allow the request
    return {
      success: true,
      remaining: maxRequests,
      resetAt: now + windowSeconds * 1000,
      limit: maxRequests,
      clientId,
      workspaceId,
    };
  }
}

/**
 * Check rate limit using the current tenant context.
 * Convenience function that extracts workspace/client from context.
 *
 * @param category - Rate limit category
 * @param overrides - Optional limit overrides
 * @returns Rate limit result
 */
export async function checkContextRateLimit(
  category: TenantRateLimitCategory,
  overrides?: Partial<TenantRateLimitConfig>
): Promise<TenantRateLimitResult> {
  const tenant = getTenantContextOrNull();

  if (!tenant) {
    // No tenant context - use a default workspace for anonymous limits
    return checkTenantRateLimit("anonymous", undefined, {
      ...DEFAULT_TENANT_LIMITS[category],
      category,
      ...overrides,
    });
  }

  return checkTenantRateLimit(tenant.workspaceId, tenant.clientId, {
    ...DEFAULT_TENANT_LIMITS[category],
    category,
    ...overrides,
  });
}

// --- Usage Tracking ---

/**
 * Get current rate limit usage for a tenant.
 * Does not increment the counter.
 *
 * @param workspaceId - Workspace to check
 * @param clientId - Optional client ID
 * @param category - Rate limit category
 * @returns Current usage information
 */
export async function getTenantRateLimitUsage(
  workspaceId: string,
  clientId: string | undefined,
  category: TenantRateLimitCategory
): Promise<{
  used: number;
  remaining: number;
  limit: number;
  resetAt: number;
}> {
  const { maxRequests, windowSeconds } = DEFAULT_TENANT_LIMITS[category];
  const key = getTenantRateLimitKey(workspaceId, clientId, category);
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Clean up and count
    await redis.zremrangebyscore(key, 0, windowStart);
    const used = await redis.zcard(key);

    return {
      used,
      remaining: Math.max(0, maxRequests - used),
      limit: maxRequests,
      resetAt: now + windowSeconds * 1000,
    };
  } catch {
    return {
      used: 0,
      remaining: maxRequests,
      limit: maxRequests,
      resetAt: now + windowSeconds * 1000,
    };
  }
}

/**
 * Get rate limit usage for all categories for a tenant.
 * Useful for displaying quota dashboards.
 */
export async function getAllTenantRateLimitUsage(
  workspaceId: string,
  clientId?: string
): Promise<
  Record<
    TenantRateLimitCategory,
    {
      used: number;
      remaining: number;
      limit: number;
      resetAt: number;
    }
  >
> {
  const categories = Object.keys(
    DEFAULT_TENANT_LIMITS
  ) as TenantRateLimitCategory[];

  const results = await Promise.all(
    categories.map(async (category) => {
      const usage = await getTenantRateLimitUsage(workspaceId, clientId, category);
      return [category, usage] as const;
    })
  );

  return Object.fromEntries(results) as Record<
    TenantRateLimitCategory,
    {
      used: number;
      remaining: number;
      limit: number;
      resetAt: number;
    }
  >;
}

// --- Header Generation ---

/**
 * Generate rate limit headers for HTTP responses.
 */
export function createTenantRateLimitHeaders(
  result: TenantRateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "X-RateLimit-Scope": result.clientId
      ? `client:${result.clientId}`
      : `workspace:${result.workspaceId}`,
  };
}

// --- Rate Limit Error ---

/**
 * Error thrown when rate limit is reached.
 */
export class TenantRateLimitError extends Error {
  constructor(
    message: string,
    public result: TenantRateLimitResult
  ) {
    super(message);
    this.name = "TenantRateLimitError";
  }

  /**
   * Get retry-after value in seconds.
   */
  get retryAfter(): number {
    return Math.ceil((this.result.resetAt - Date.now()) / 1000);
  }
}

/**
 * Check rate limit and throw if reached.
 * Convenience function for use in handlers.
 *
 * @throws TenantRateLimitError if rate limit reached
 */
export async function enforceTenantRateLimit(
  workspaceId: string,
  clientId: string | undefined,
  config: TenantRateLimitConfig
): Promise<TenantRateLimitResult> {
  const result = await checkTenantRateLimit(workspaceId, clientId, config);

  if (!result.success) {
    const retryMinutes = Math.ceil((result.resetAt - Date.now()) / 60000);
    throw new TenantRateLimitError(
      `Rate limit reached for ${config.category}. ` +
        `Try again in ${retryMinutes} minute${retryMinutes !== 1 ? "s" : ""}.`,
      result
    );
  }

  return result;
}

/**
 * Reset rate limit for a tenant (for testing/admin purposes).
 */
export async function resetTenantRateLimit(
  workspaceId: string,
  clientId: string | undefined,
  category: TenantRateLimitCategory
): Promise<void> {
  const key = getTenantRateLimitKey(workspaceId, clientId, category);
  try {
    await redis.del(key);
  } catch (error) {
    logger.warn(
      "[tenant-rate-limit] Failed to reset rate limit",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}
