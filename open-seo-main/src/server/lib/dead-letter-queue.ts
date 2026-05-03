/**
 * Dead Letter Queue Service
 *
 * Plan 69-04 Task 4: Manages failed jobs for inspection and replay.
 *
 * Provides:
 * - moveToDeadLetter: Store failed job with error info
 * - replayFromDeadLetter: Re-queue job and remove from DLQ
 * - listDeadLetterJobs: Query DLQ with filters
 * - purgeDeadLetterJobs: Clean up old entries
 *
 * @module server/lib/dead-letter-queue
 */

import { db } from "@/db";
import { deadLetterJobs, type DeadLetterJobInsert } from "@/db/dead-letter-queue-schema";
import { eq, and, isNull, lt, desc, sql } from "drizzle-orm";
import { createLogger } from "./logger";

const log = createLogger({ module: "dead-letter-queue" });

/**
 * Information about a failed job to store in DLQ.
 */
export interface FailedJobInfo {
  /** Original job ID from the queue */
  jobId: string;
  /** Queue name (e.g., "audit", "report") */
  queue: string;
  /** Job name/type */
  jobName: string;
  /** Original job data */
  data: unknown;
  /** Error message */
  error: string;
  /** Error stack trace */
  stackTrace?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Additional metadata */
  metadata?: {
    lastAttemptAt?: string;
    failureHistory?: Array<{ error: string; timestamp: string }>;
    workerInfo?: string;
    processingDurationMs?: number;
    originalTimestamp?: string;
  };
}

/**
 * Move a failed job to the dead letter queue.
 *
 * Called when a job exhausts all retry attempts. Stores the job data
 * and failure information for later inspection and potential replay.
 *
 * @param jobInfo - Failed job information
 * @returns The created DLQ entry ID
 *
 * @example
 * await moveToDeadLetter({
 *   jobId: job.id,
 *   queue: "audit",
 *   jobName: "runAudit",
 *   data: job.data,
 *   error: err.message,
 *   stackTrace: err.stack,
 *   retryCount: job.attemptsMade,
 * });
 */
export async function moveToDeadLetter(jobInfo: FailedJobInfo): Promise<string> {
  const {
    jobId,
    queue,
    jobName,
    data,
    error,
    stackTrace,
    retryCount,
    metadata,
  } = jobInfo;

  const insert: DeadLetterJobInsert = {
    originalJobId: jobId,
    queue,
    jobName,
    data: data as Record<string, unknown>,
    error,
    stackTrace: stackTrace ?? null,
    retryCount,
    metadata: metadata ?? null,
    failedAt: new Date(),
  };

  const [result] = await db
    .insert(deadLetterJobs)
    .values(insert)
    .returning({ id: deadLetterJobs.id });

  log.info("Job moved to dead letter queue", {
    dlqId: result.id,
    originalJobId: jobId,
    queue,
    jobName,
    retryCount,
  });

  return result.id;
}

/**
 * Options for replaying a job from the DLQ.
 */
export interface ReplayOptions {
  /** Override the original queue (for routing to a different queue) */
  targetQueue?: string;
  /** Modify the job data before replay */
  dataTransform?: (data: unknown) => unknown;
  /** Whether to remove from DLQ after successful enqueue (default: true) */
  removeAfterReplay?: boolean;
}

/**
 * Replay a job from the dead letter queue.
 *
 * Re-enqueues the job to its original (or specified) queue and optionally
 * removes it from the DLQ. The job data can be transformed before replay.
 *
 * @param dlqId - Dead letter queue entry ID
 * @param enqueueJob - Function to enqueue the job (injected for flexibility)
 * @param options - Replay options
 * @returns true if replayed successfully, false if not found
 *
 * @example
 * const replayed = await replayFromDeadLetter(
 *   dlqId,
 *   async (queue, jobName, data) => {
 *     await auditQueue.add(jobName, data);
 *   }
 * );
 */
export async function replayFromDeadLetter(
  dlqId: string,
  enqueueJob: (queue: string, jobName: string, data: unknown) => Promise<void>,
  options: ReplayOptions = {}
): Promise<boolean> {
  const { targetQueue, dataTransform, removeAfterReplay = true } = options;

  // Find the DLQ entry
  const [entry] = await db
    .select()
    .from(deadLetterJobs)
    .where(eq(deadLetterJobs.id, dlqId))
    .limit(1);

  if (!entry) {
    log.warn("DLQ entry not found for replay", { dlqId });
    return false;
  }

  // Prepare job data
  const queue = targetQueue ?? entry.queue;
  const data = dataTransform ? dataTransform(entry.data) : entry.data;

  try {
    // Re-enqueue the job
    await enqueueJob(queue, entry.jobName, data);

    log.info("Job replayed from dead letter queue", {
      dlqId,
      originalJobId: entry.originalJobId,
      queue,
      jobName: entry.jobName,
    });

    if (removeAfterReplay) {
      // Mark as replayed (or delete)
      await db
        .update(deadLetterJobs)
        .set({ replayedAt: new Date() })
        .where(eq(deadLetterJobs.id, dlqId));
    }

    return true;
  } catch (err) {
    log.error("Failed to replay job from DLQ", {
      dlqId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Query options for listing DLQ entries.
 */
export interface ListDeadLetterOptions {
  /** Filter by queue name */
  queue?: string;
  /** Filter by job name */
  jobName?: string;
  /** Only show unreplayed entries */
  unreplayedOnly?: boolean;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * List jobs in the dead letter queue.
 *
 * @param options - Query filters and pagination
 * @returns Array of DLQ entries
 */
export async function listDeadLetterJobs(options: ListDeadLetterOptions = {}) {
  const {
    queue,
    jobName,
    unreplayedOnly = false,
    limit = 50,
    offset = 0,
  } = options;

  const conditions = [];

  if (queue) {
    conditions.push(eq(deadLetterJobs.queue, queue));
  }

  if (jobName) {
    conditions.push(eq(deadLetterJobs.jobName, jobName));
  }

  if (unreplayedOnly) {
    conditions.push(isNull(deadLetterJobs.replayedAt));
  }

  const query = db
    .select()
    .from(deadLetterJobs)
    .orderBy(desc(deadLetterJobs.failedAt))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

/**
 * Get a single DLQ entry by ID.
 */
export async function getDeadLetterJob(dlqId: string) {
  const [entry] = await db
    .select()
    .from(deadLetterJobs)
    .where(eq(deadLetterJobs.id, dlqId))
    .limit(1);

  return entry ?? null;
}

/**
 * Count jobs in the dead letter queue.
 *
 * @param options - Filter options (queue, jobName, unreplayedOnly)
 * @returns Count of matching entries
 */
export async function countDeadLetterJobs(
  options: Pick<ListDeadLetterOptions, "queue" | "jobName" | "unreplayedOnly"> = {}
): Promise<number> {
  const { queue, jobName, unreplayedOnly = false } = options;

  const conditions = [];

  if (queue) {
    conditions.push(eq(deadLetterJobs.queue, queue));
  }

  if (jobName) {
    conditions.push(eq(deadLetterJobs.jobName, jobName));
  }

  if (unreplayedOnly) {
    conditions.push(isNull(deadLetterJobs.replayedAt));
  }

  const query = db
    .select({ count: sql<number>`count(*)::int` })
    .from(deadLetterJobs);

  const [result] = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  return result?.count ?? 0;
}

/**
 * Delete a DLQ entry permanently.
 *
 * @param dlqId - DLQ entry ID to delete
 * @returns true if deleted, false if not found
 */
export async function deleteDeadLetterJob(dlqId: string): Promise<boolean> {
  const result = await db
    .delete(deadLetterJobs)
    .where(eq(deadLetterJobs.id, dlqId))
    .returning({ id: deadLetterJobs.id });

  if (result.length > 0) {
    log.info("Deleted DLQ entry", { dlqId });
    return true;
  }

  return false;
}

/**
 * Purge old entries from the dead letter queue.
 *
 * @param olderThanDays - Delete entries older than this many days
 * @param options - Additional filters
 * @returns Number of entries deleted
 */
export async function purgeDeadLetterJobs(
  olderThanDays: number,
  options: { replayedOnly?: boolean } = {}
): Promise<number> {
  const { replayedOnly = false } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const conditions = [lt(deadLetterJobs.failedAt, cutoffDate)];

  if (replayedOnly) {
    conditions.push(sql`${deadLetterJobs.replayedAt} IS NOT NULL`);
  }

  const result = await db
    .delete(deadLetterJobs)
    .where(and(...conditions))
    .returning({ id: deadLetterJobs.id });

  const deletedCount = result.length;

  if (deletedCount > 0) {
    log.info("Purged old DLQ entries", {
      deletedCount,
      olderThanDays,
      replayedOnly,
    });
  }

  return deletedCount;
}

/**
 * Get DLQ statistics for monitoring.
 */
export async function getDeadLetterStats(): Promise<{
  total: number;
  unreplayed: number;
  byQueue: Record<string, number>;
  byJobName: Record<string, number>;
  last24h: number;
}> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [totals, byQueue, byJobName, recent] = await Promise.all([
    // Total and unreplayed counts
    db
      .select({
        total: sql<number>`count(*)::int`,
        unreplayed: sql<number>`count(*) filter (where ${deadLetterJobs.replayedAt} is null)::int`,
      })
      .from(deadLetterJobs),

    // Count by queue
    db
      .select({
        queue: deadLetterJobs.queue,
        count: sql<number>`count(*)::int`,
      })
      .from(deadLetterJobs)
      .where(isNull(deadLetterJobs.replayedAt))
      .groupBy(deadLetterJobs.queue),

    // Count by job name
    db
      .select({
        jobName: deadLetterJobs.jobName,
        count: sql<number>`count(*)::int`,
      })
      .from(deadLetterJobs)
      .where(isNull(deadLetterJobs.replayedAt))
      .groupBy(deadLetterJobs.jobName),

    // Last 24 hours
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterJobs)
      .where(sql`${deadLetterJobs.failedAt} > ${yesterday}`),
  ]);

  return {
    total: totals[0]?.total ?? 0,
    unreplayed: totals[0]?.unreplayed ?? 0,
    byQueue: Object.fromEntries(byQueue.map((r) => [r.queue, r.count])),
    byJobName: Object.fromEntries(byJobName.map((r) => [r.jobName, r.count])),
    last24h: recent[0]?.count ?? 0,
  };
}
