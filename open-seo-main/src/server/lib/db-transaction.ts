/**
 * Transaction wrappers for data integrity.
 * Phase 69-01: Transaction Wrappers
 *
 * Provides:
 * - withTransaction: Standardized transaction wrapper with rollback safety
 * - TransactionContext: Post-commit job collection for webhook delivery
 *
 * Usage:
 * ```typescript
 * const txContext = new TransactionContext();
 *
 * const result = await withTransaction(async (tx) => {
 *   const [record] = await tx.insert(table).values({...}).returning();
 *   txContext.addPostCommitJob({
 *     queue: 'webhooks',
 *     jobName: 'entity.created',
 *     data: { id: record.id },
 *   });
 *   return record;
 * });
 *
 * // Enqueue jobs AFTER commit succeeds
 * await enqueuePostCommitJobs(txContext.getPostCommitJobs());
 * ```
 */

import { db, type DrizzleTransaction } from "@/db";
import { AppError } from "./errors";
import type { ErrorCode } from "@/shared/error-codes";

/**
 * Callback function executed within a transaction context.
 * Receives the Drizzle transaction client.
 */
type TransactionCallback<T> = (tx: DrizzleTransaction) => Promise<T>;

/**
 * Options for transaction execution.
 */
export interface TransactionOptions {
  /**
   * PostgreSQL isolation level.
   * - 'read committed': Default, sees committed data during transaction
   * - 'serializable': Strictest, may require retry on serialization failure
   */
  isolationLevel?: "read committed" | "serializable";
}

/**
 * Execute a callback within a database transaction.
 *
 * Features:
 * - Automatic rollback on any error
 * - Preserves AppError instances for proper error handling
 * - Wraps unknown errors with TRANSACTION_FAILED code
 *
 * @param callback - Function to execute within transaction
 * @param options - Optional transaction configuration
 * @returns Result of the callback
 * @throws AppError if callback throws or transaction fails
 *
 * @example
 * ```typescript
 * const client = await withTransaction(async (tx) => {
 *   const [created] = await tx.insert(clients).values({...}).returning();
 *   await tx.update(prospects).set({ status: 'converted' }).where(...);
 *   return created;
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>,
  options?: TransactionOptions,
): Promise<T> {
  try {
    // Drizzle transaction handles commit on success, rollback on error
    return await db.transaction(
      async (tx) => {
        return callback(tx);
      },
      {
        isolationLevel: options?.isolationLevel,
      },
    );
  } catch (error) {
    // Preserve AppError for proper error code propagation
    if (error instanceof AppError) {
      throw error;
    }

    // Log detailed error for debugging (never expose in response)
    console.error("[withTransaction] Transaction failed:", error);

    // Wrap unknown errors with TRANSACTION_FAILED code
    // This is added to error-codes.ts as a valid ErrorCode
    throw new AppError(
      "INTERNAL_ERROR" as ErrorCode,
      `Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Job to be enqueued after transaction commits.
 * Used to prevent job processing before data is committed.
 */
export interface PostCommitJob {
  /** BullMQ queue name */
  queue: string;
  /** Job name/type */
  jobName: string;
  /** Job data payload */
  data: Record<string, unknown>;
  /** Optional job options */
  options?: {
    /** Custom job ID for deduplication */
    jobId?: string;
    /** Delay in milliseconds before processing */
    delay?: number;
    /** Number of retry attempts */
    attempts?: number;
  };
}

/**
 * Collects jobs to be enqueued after transaction commits.
 *
 * Why post-commit jobs?
 * - Webhook workers should not process events for uncommitted data
 * - If transaction rolls back, collected jobs are discarded
 * - Ensures data consistency between DB and job queue
 *
 * Usage:
 * ```typescript
 * const txContext = new TransactionContext();
 *
 * await withTransaction(async (tx) => {
 *   // ... DB operations
 *   txContext.addPostCommitJob({ queue: 'webhooks', jobName: 'created', data: {...} });
 * });
 *
 * // Only enqueue if transaction succeeded
 * await enqueuePostCommitJobs(txContext.getPostCommitJobs());
 * ```
 */
export class TransactionContext {
  private postCommitJobs: PostCommitJob[] = [];

  /**
   * Add a job to be enqueued after transaction commits.
   * Jobs are collected but not executed until explicitly processed.
   */
  addPostCommitJob(job: PostCommitJob): void {
    this.postCommitJobs.push(job);
  }

  /**
   * Get all collected post-commit jobs.
   * Call this after withTransaction() succeeds.
   */
  getPostCommitJobs(): PostCommitJob[] {
    return [...this.postCommitJobs];
  }

  /**
   * Clear all collected jobs.
   * Useful for retry scenarios or explicit cleanup.
   */
  clear(): void {
    this.postCommitJobs = [];
  }

  /**
   * Check if any jobs have been collected.
   */
  hasJobs(): boolean {
    return this.postCommitJobs.length > 0;
  }

  /**
   * Get count of collected jobs.
   */
  getJobCount(): number {
    return this.postCommitJobs.length;
  }
}

/**
 * Type for entities that can be passed to withTransactionAndContext.
 * Used when you want both the transaction result and context in one call.
 */
export interface TransactionResult<T> {
  result: T;
  context: TransactionContext;
}

/**
 * Execute transaction and return both result and context.
 * Convenience wrapper for common pattern.
 *
 * @example
 * ```typescript
 * const { result: client, context } = await withTransactionAndContext(async (tx, ctx) => {
 *   const [created] = await tx.insert(clients).values({...}).returning();
 *   ctx.addPostCommitJob({ queue: 'webhooks', jobName: 'created', data: { id: created.id } });
 *   return created;
 * });
 *
 * await enqueuePostCommitJobs(context.getPostCommitJobs());
 * ```
 */
export async function withTransactionAndContext<T>(
  callback: (tx: DrizzleTransaction, ctx: TransactionContext) => Promise<T>,
  options?: TransactionOptions,
): Promise<TransactionResult<T>> {
  const context = new TransactionContext();

  const result = await withTransaction(async (tx) => {
    return callback(tx, context);
  }, options);

  return { result, context };
}
