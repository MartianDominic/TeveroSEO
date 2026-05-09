/**
 * Idempotency middleware for preventing duplicate request processing.
 *
 * Ensures that the same request (identified by an idempotency key) is only
 * processed once, with subsequent requests returning the cached result.
 *
 * Features:
 * - Header-based or auto-generated idempotency keys
 * - Result caching for automatic replay
 * - Processing lock to prevent duplicate concurrent processing
 * - Configurable TTL for result retention
 * - Graceful degradation when Redis is unavailable
 */

import crypto from "crypto";

import { z } from "zod";


import { logger } from '@/lib/logger';
import { redis } from "@/lib/redis/client";
import { safeJsonParseWithSchema } from "@/lib/utils/type-guards";
/** Key prefix for idempotency entries */
const IDEMPOTENCY_PREFIX = "tevero:idempotency:";

/** Default TTL for idempotency results in seconds (24 hours) */
const DEFAULT_RESULT_TTL = 86400;

/** Processing marker value */
const PROCESSING_MARKER = "__processing__";

/** Max wait time for processing lock in milliseconds */
const PROCESSING_WAIT_TIMEOUT = 30000;

/** Poll interval when waiting for processing in milliseconds */
const PROCESSING_POLL_INTERVAL = 100;

export interface IdempotencyResult<T> {
  /** Whether this was a cached result (true) or freshly computed (false) */
  cached: boolean;
  /** The operation result */
  data: T;
  /** The idempotency key used */
  key: string;
}

export interface IdempotencyOptions {
  /** TTL for the cached result in seconds (default: 24 hours) */
  ttlSeconds?: number;
  /** Custom key generator function */
  keyGenerator?: () => string;
  /** Whether to throw on concurrent duplicate requests (default: false - waits) */
  throwOnConcurrent?: boolean;
}

interface StoredResult<T> {
  data: T;
  completedAt: string;
  status: "completed" | "error";
  errorMessage?: string;
}

/**
 * Zod schema for validating StoredResult structure from Redis.
 * Note: data field is validated as unknown since we can't know T at parse time.
 */
const StoredResultSchema = z.object({
  data: z.unknown(),
  completedAt: z.string(),
  status: z.enum(["completed", "error"]),
  errorMessage: z.string().optional(),
});

/**
 * Parse and validate a StoredResult from a JSON string.
 * Returns null if parsing or validation fails.
 */
function parseStoredResult<T>(
  json: string,
  context: string
): StoredResult<T> | null {
  const result = safeJsonParseWithSchema(json, StoredResultSchema, context);
  if (!result.success) {
    return null;
  }
  // Cast is safe here because we validated the structure
  return result.data as StoredResult<T>;
}

/**
 * Generate a unique idempotency key from request parameters.
 *
 * @param params - Request parameters to hash
 * @returns 32-character hex hash suitable for use as idempotency key
 */
export function generateIdempotencyKey(
  params: Record<string, unknown>
): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>
    );

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortedParams))
    .digest("hex")
    .substring(0, 32);
}

/**
 * Generate a random idempotency key.
 * Use when the client should provide a unique key per request attempt.
 */
export function generateRandomKey(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Sleep helper for polling.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an operation with idempotency protection.
 *
 * If a request with the same key was already processed, returns the cached result.
 * If a request with the same key is currently processing, waits for it to complete.
 * Otherwise, executes the operation and caches the result.
 *
 * @param key - Idempotency key (use generateIdempotencyKey or provide from header)
 * @param operation - Async operation to execute
 * @param options - Idempotency configuration
 * @returns IdempotencyResult with data and cached flag
 *
 * @example
 * ```typescript
 * // Using header-provided key
 * const idempotencyKey = request.headers.get("Idempotency-Key");
 * if (!idempotencyKey) {
 *   return { error: "Idempotency-Key header required" };
 * }
 *
 * const result = await withIdempotency(
 *   idempotencyKey,
 *   async () => {
 *     await chargeCustomer(customerId, amount);
 *     return { success: true, chargeId: "ch_123" };
 *   }
 * );
 *
 * // result.cached tells you if this was a replay
 * ```
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  options: IdempotencyOptions = {}
): Promise<IdempotencyResult<T>> {
  const {
    ttlSeconds = DEFAULT_RESULT_TTL,
    throwOnConcurrent = false,
  } = options;

  const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;

  try {
    // Check for existing result or processing state
    const existing = await redis.get(redisKey);

    if (existing && existing !== PROCESSING_MARKER) {
      // Completed result exists - return it
      const storedResult = parseStoredResult<T>(existing, `idempotency:${key}`);
      if (!storedResult) {
        // Invalid cached data - clear it and proceed to re-execute
        console.warn(`[idempotency] Invalid cached result for key "${key}", clearing cache`);
        await redis.del(redisKey);
      } else {
        if (storedResult.status === "error") {
          throw new Error(storedResult.errorMessage || "Previous request failed");
        }
        return {
          cached: true,
          data: storedResult.data,
          key,
        };
      }
    }

    // Try to acquire processing lock
    const acquired = await redis.set(
      redisKey,
      PROCESSING_MARKER,
      "EX",
      ttlSeconds,
      "NX"
    );

    if (!acquired) {
      // Another request is processing
      if (throwOnConcurrent) {
        throw new IdempotencyConflictError(
          `Request with key "${key}" is already being processed`
        );
      }

      // Wait for the other request to complete
      const result = await waitForResult<T>(redisKey, PROCESSING_WAIT_TIMEOUT);
      if (result) {
        return {
          cached: true,
          data: result,
          key,
        };
      }

      // Timeout waiting - the other request may have failed silently
      // Fall through to execute ourselves
    }

    // Execute the operation
    try {
      const data = await operation();

      // Store successful result
      const storedResult: StoredResult<T> = {
        data,
        completedAt: new Date().toISOString(),
        status: "completed",
      };

      await redis.setex(redisKey, ttlSeconds, JSON.stringify(storedResult));

      return {
        cached: false,
        data,
        key,
      };
    } catch (error) {
      // Store error result to prevent retries from succeeding on transient failures
      // But allow different errors to be distinguished
      const storedResult: StoredResult<never> = {
        data: null as never,
        completedAt: new Date().toISOString(),
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      };

      await redis.setex(redisKey, ttlSeconds, JSON.stringify(storedResult));
      throw error;
    }
  } catch (error) {
    // If Redis fails, fall through to execute operation directly
    // This provides graceful degradation but loses idempotency guarantees
    if (
      error instanceof Error &&
      (error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND"))
    ) {
      console.error(
        "[idempotency] Redis unavailable, executing without idempotency"
      );
      const data = await operation();
      return {
        cached: false,
        data,
        key,
      };
    }
    throw error;
  }
}

/**
 * Wait for a processing request to complete and return its result.
 */
async function waitForResult<T>(
  redisKey: string,
  timeoutMs: number
): Promise<T | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await sleep(PROCESSING_POLL_INTERVAL);

    const value = await redis.get(redisKey);

    // Lock was released (request failed)
    if (value === null) {
      return null;
    }

    // Still processing
    if (value === PROCESSING_MARKER) {
      continue;
    }

    // Result available
    const storedResult = parseStoredResult<T>(value, `idempotency:waitForResult`);
    if (!storedResult) {
      // Invalid data in cache, return null to trigger re-execution
      return null;
    }
    if (storedResult.status === "error") {
      throw new Error(storedResult.errorMessage || "Previous request failed");
    }
    return storedResult.data;
  }

  // Timeout
  return null;
}

/**
 * Check if an idempotency key has a cached result.
 *
 * @param key - Idempotency key to check
 * @returns Status of the key
 */
export async function getIdempotencyStatus(
  key: string
): Promise<"none" | "processing" | "completed" | "error"> {
  const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;

  try {
    const value = await redis.get(redisKey);

    if (value === null) {
      return "none";
    }

    if (value === PROCESSING_MARKER) {
      return "processing";
    }

    const storedResult = parseStoredResult<unknown>(value, `idempotency:status:${key}`);
    if (!storedResult) {
      return "none";
    }
    return storedResult.status;
  } catch {
    return "none";
  }
}

/**
 * Clear an idempotency key to allow re-processing.
 * Use with caution - this defeats the purpose of idempotency.
 *
 * @param key - Idempotency key to clear
 */
export async function clearIdempotencyKey(key: string): Promise<void> {
  const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;
  await redis.del(redisKey);
}

/**
 * Error thrown when a concurrent request with the same idempotency key
 * is already being processed and throwOnConcurrent is true.
 */
export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

/**
 * Create an idempotent server action wrapper.
 *
 * Wraps a server action to automatically handle idempotency based on
 * the action parameters. Useful for form submissions and mutations.
 *
 * @param action - Server action to wrap
 * @param keyPrefix - Prefix for idempotency keys
 * @param options - Idempotency options
 * @returns Wrapped action with idempotency protection
 *
 * @example
 * ```typescript
 * // Define the base action
 * async function createOrder(data: OrderData) {
 *   return await db.orders.create(data);
 * }
 *
 * // Wrap with idempotency
 * export const createOrderIdempotent = createIdempotentAction(
 *   createOrder,
 *   "create-order",
 *   { ttlSeconds: 3600 }
 * );
 *
 * // Use in component
 * const result = await createOrderIdempotent(orderData);
 * ```
 */
export function createIdempotentAction<TParams extends Record<string, unknown>, TResult>(
  action: (params: TParams) => Promise<TResult>,
  keyPrefix: string,
  options: Omit<IdempotencyOptions, "keyGenerator"> = {}
): (params: TParams, idempotencyKey?: string) => Promise<IdempotencyResult<TResult>> {
  return async (params: TParams, providedKey?: string) => {
    const key = providedKey || `${keyPrefix}:${generateIdempotencyKey(params)}`;

    return withIdempotency(
      key,
      () => action(params),
      options
    );
  };
}

/**
 * Extract idempotency key from request headers.
 * Supports common header names used by payment processors and APIs.
 *
 * @param headers - Request headers (Headers object or plain object)
 * @returns Idempotency key or null if not found
 */
export function extractIdempotencyKey(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  const headerNames = [
    "Idempotency-Key",
    "X-Idempotency-Key",
    "X-Request-Id",
    "X-Unique-ID",
  ];

  for (const name of headerNames) {
    let value: string | null | undefined;

    if (headers instanceof Headers) {
      value = headers.get(name);
    } else {
      const headerValue = headers[name] || headers[name.toLowerCase()];
      value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    }

    if (value && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}
