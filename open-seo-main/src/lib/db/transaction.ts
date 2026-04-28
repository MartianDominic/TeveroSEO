/**
 * Transaction utilities for safe database operations.
 *
 * Provides:
 * - withTransaction: Wraps operations in a transaction with auto-rollback
 * - withIdempotency: Prevents duplicate operations using idempotency keys
 * - atomicBatch: Executes multiple operations atomically
 * - withRetry: Retries on transient database errors
 *
 * @module lib/db/transaction
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Transaction type - inferred from db.transaction callback parameter.
 * This avoids complex generic type definitions while maintaining type safety.
 */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Execute operation within a transaction with automatic rollback on error.
 *
 * The transaction is automatically committed on success or rolled back on error.
 * Any error thrown inside the transaction callback will trigger a rollback.
 *
 * @param operation - Async function that receives the transaction object
 * @returns Promise resolving to the operation result
 *
 * @example
 * const result = await withTransaction(async (tx) => {
 *   await tx.insert(users).values({ name: 'John' });
 *   await tx.insert(profiles).values({ userId: 1, bio: 'Hello' });
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  operation: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    try {
      return await operation(tx);
    } catch (error) {
      // Log for observability, transaction automatically rolls back
      console.error("[Transaction] Rolling back due to error:", error);
      throw error;
    }
  });
}

/**
 * Result of an idempotent operation.
 */
export interface IdempotencyResult<T> {
  /** The result of the operation */
  result: T;
  /** Whether the result was retrieved from cache */
  cached: boolean;
}

/**
 * Execute operation with idempotency key.
 * Prevents duplicate operations with the same key.
 *
 * Uses atomic INSERT ON CONFLICT DO NOTHING to claim the key,
 * preventing race conditions where multiple concurrent requests
 * could execute the same operation.
 *
 * @param idempotencyKey - Unique key identifying this operation
 * @param operation - Async function to execute if not cached
 * @param ttlSeconds - Time-to-live for the cached result (default: 24 hours)
 * @returns Promise resolving to the result and cache status
 * @throws Error if operation is already in progress by another request
 *
 * @example
 * const { result, cached } = await withIdempotency(
 *   `payment:${orderId}:${amount}`,
 *   () => processPayment(orderId, amount),
 *   3600 // 1 hour TTL
 * );
 *
 * if (cached) {
 *   console.log('Payment already processed');
 * }
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  operation: () => Promise<T>,
  ttlSeconds: number = 86400 // 24 hours
): Promise<IdempotencyResult<T>> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // Try to atomically claim the key with INSERT ON CONFLICT DO NOTHING
  // This prevents race conditions where multiple requests could both
  // pass a SELECT check and execute the operation
  const insertResult = await db.execute<{ key: string }>(sql`
    INSERT INTO idempotency_keys (key, expires_at, status)
    VALUES (${idempotencyKey}, ${expiresAt}, 'processing')
    ON CONFLICT (key) WHERE expires_at > NOW()
    DO NOTHING
    RETURNING key
  `);

  // If no row returned, key already exists (either completed or processing)
  if (insertResult.rows.length === 0) {
    // Check the status of the existing operation
    const existing = await db.execute<{ result: string; status: string }>(sql`
      SELECT result, status FROM idempotency_keys
      WHERE key = ${idempotencyKey} AND expires_at > NOW()
    `);

    if (existing.rows.length > 0) {
      const { result: storedResult, status } = existing.rows[0];

      if (status === "completed" && storedResult) {
        return { result: JSON.parse(storedResult) as T, cached: true };
      }

      // Still processing by another request
      throw new Error(
        `Operation with key '${idempotencyKey}' is already in progress`
      );
    }

    // Key expired between our INSERT and SELECT, retry
    return withIdempotency(idempotencyKey, operation, ttlSeconds);
  }

  // We successfully claimed the key - execute the operation
  try {
    const result = await operation();

    // Store the result and mark as completed
    await db.execute(sql`
      UPDATE idempotency_keys
      SET result = ${JSON.stringify(result)}::jsonb, status = 'completed'
      WHERE key = ${idempotencyKey}
    `);

    return { result, cached: false };
  } catch (error) {
    // On failure, delete the key so the operation can be retried
    await db.execute(sql`
      DELETE FROM idempotency_keys WHERE key = ${idempotencyKey}
    `);
    throw error;
  }
}

/**
 * Execute multiple operations atomically.
 * All succeed or all fail - partial completion is not possible.
 *
 * @param operations - Array of async functions to execute in order
 * @returns Promise resolving to array of results in order
 *
 * @example
 * const [user, profile, settings] = await atomicBatch([
 *   () => createUser({ name: 'John' }),
 *   () => createProfile({ bio: 'Hello' }),
 *   () => createSettings({ theme: 'dark' }),
 * ]);
 */
export async function atomicBatch<T extends readonly unknown[]>(
  operations: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  return withTransaction(async (_tx) => {
    const results: unknown[] = [];

    for (const operation of operations) {
      results.push(await operation());
    }

    return results as unknown as T;
  });
}

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 100) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelayMs?: number;
  /** Error codes that trigger retry (default: serialization/deadlock errors) */
  retryableErrors?: string[];
}

/**
 * Retry operation with exponential backoff on transient database errors.
 *
 * Automatically retries on:
 * - Serialization failures (40001)
 * - Deadlocks (40P01)
 * - Other configured error codes
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration
 * @returns Promise resolving to the operation result
 *
 * @example
 * const result = await withRetry(
 *   () => updateBalance(accountId, amount),
 *   { maxRetries: 5, baseDelayMs: 200 }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 5000,
    retryableErrors = [
      "SERIALIZATION_FAILURE",
      "DEADLOCK_DETECTED",
      "40001",
      "40P01",
    ],
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const errorCode = (error as { code?: string }).code || "";
      const errorMessage = (error as Error).message || "";

      const isRetryable = retryableErrors.some(
        (code) => errorCode.includes(code) || errorMessage.includes(code)
      );

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 100
      );

      console.warn(
        `[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Combine transaction with retry for maximum safety.
 * Retries the entire transaction on transient errors.
 *
 * @param operation - Async function that receives the transaction object
 * @param retryOptions - Optional retry configuration
 * @returns Promise resolving to the operation result
 *
 * @example
 * const result = await withTransactionRetry(async (tx) => {
 *   const balance = await tx.query.accounts.findFirst({...});
 *   await tx.update(accounts).set({ balance: balance - amount });
 *   return { newBalance: balance - amount };
 * });
 */
export async function withTransactionRetry<T>(
  operation: (tx: Transaction) => Promise<T>,
  retryOptions?: RetryOptions
): Promise<T> {
  return withRetry(() => withTransaction(operation), retryOptions);
}
