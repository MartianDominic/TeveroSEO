/**
 * Dead Letter Queue Schema
 *
 * Plan 69-04 Task 4: Stores failed jobs for inspection and replay.
 *
 * Failed jobs are moved here after exhausting retries. Supports:
 * - Storing error details and stack traces for debugging
 * - Replaying jobs by re-enqueuing and removing from DLQ
 * - Tracking retry history and failure patterns
 *
 * @module db/dead-letter-queue-schema
 */

import {
  pgTable,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * Dead letter jobs table.
 *
 * Stores failed jobs that have exhausted their retry attempts.
 * Each entry preserves the original job data and failure context
 * for debugging and potential replay.
 */
export const deadLetterJobs = pgTable(
  "dead_letter_jobs",
  {
    /** Unique identifier for the DLQ entry */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Original job ID from the source queue */
    originalJobId: varchar("original_job_id", { length: 255 }).notNull(),

    /** Queue name where the job originated (e.g., "audit", "report") */
    queue: varchar("queue", { length: 100 }).notNull(),

    /** Job name/type (e.g., "runAudit", "generateReport") */
    jobName: varchar("job_name", { length: 255 }).notNull(),

    /** Original job data as JSON */
    data: jsonb("data").notNull(),

    /** Error message from the final failure */
    error: text("error").notNull(),

    /** Error stack trace (if available) */
    stackTrace: text("stack_trace"),

    /** When the job permanently failed */
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    /** Number of retry attempts before DLQ */
    retryCount: integer("retry_count").notNull().default(0),

    /**
     * Additional metadata about the failure:
     * - lastAttemptAt: timestamp of final attempt
     * - failureHistory: array of {error, timestamp} for each attempt
     * - workerInfo: worker ID/hostname that processed the job
     * - processingDurationMs: how long the job ran before failing
     */
    metadata: jsonb("metadata").$type<{
      lastAttemptAt?: string;
      failureHistory?: Array<{ error: string; timestamp: string }>;
      workerInfo?: string;
      processingDurationMs?: number;
      originalTimestamp?: string;
    }>(),

    /** When the job was replayed (null if never replayed) */
    replayedAt: timestamp("replayed_at", { withTimezone: true, mode: "date" }),

    /** Created timestamp for the DLQ entry */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Index for queue-based filtering
    index("idx_dlq_queue").on(table.queue),

    // Index for job name filtering
    index("idx_dlq_job_name").on(table.jobName),

    // Index for finding unreplayed jobs
    index("idx_dlq_replayed_at").on(table.replayedAt),

    // Index for time-based queries
    index("idx_dlq_failed_at").on(table.failedAt),

    // Composite index for queue + unreplayed
    index("idx_dlq_queue_unreplayed").on(table.queue, table.replayedAt),
  ]
);

/** Type for SELECT queries */
export type DeadLetterJob = InferSelectModel<typeof deadLetterJobs>;

/** Type for INSERT queries */
export type DeadLetterJobInsert = InferInsertModel<typeof deadLetterJobs>;

/**
 * Relations for dead letter jobs.
 * Currently standalone, but could be extended to link to specific entities.
 */
export const deadLetterJobsRelations = relations(deadLetterJobs, () => ({}));
