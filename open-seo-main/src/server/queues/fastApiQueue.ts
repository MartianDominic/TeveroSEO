/**
 * Fast API Queue - High concurrency queue for fast SEO operations.
 *
 * Per 64-RESEARCH.md Pattern 2:
 * - SLA: <1 minute
 * - Types: B (Competitor Snapshot), C (Keyword Gap), D (Backlink Profile),
 *          E (Content Gap), F (Local SEO)
 * - Concurrency: 50 (high for I/O-bound API calls)
 *
 * Separate from heavy-crawl (auditQueue) to ensure SLA isolation.
 * Heavy audits (<15 min SLA) cannot block fast API operations (<1 min SLA).
 *
 * @module fastApiQueue
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

export const FAST_API_QUEUE_NAME = "fast-api" as const;

/**
 * Job types processed by the fast-api queue.
 * Type A (FULL_AUDIT) is explicitly excluded - routes to auditQueue.
 */
export type FastApiJobType = "B" | "C" | "D" | "E" | "F";

/**
 * Job data for fast-api queue operations.
 *
 * All jobs include routing metadata (lane, enqueuedAt, jobType) plus
 * type-specific payload data.
 */
export interface FastApiJobData {
  /** Job type (B, C, D, E, or F) */
  type: FastApiJobType;
  /** Project identifier */
  projectId: string;
  /** Target URL for the operation */
  url: string;
  /** Tenant ID for isolation */
  tenantId: string;
  /** Type-specific data */
  payload: Record<string, unknown>;
  /** Routing metadata - which lane this job is in */
  lane: "fast-api";
  /** Timestamp when job was enqueued */
  enqueuedAt: number;
  /** Job type for metadata tracking */
  jobType: FastApiJobType;
}

/**
 * Default job options for fast-api queue.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 * 2 attempts for fast operations with small footprint.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  attempts: 2,
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
});

/**
 * Fast API queue for Types B/C/D/E/F SEO operations.
 *
 * Uses separate Redis connection to prevent connection leaks.
 * Worker defined in fast-api-worker.ts.
 */
export const fastApiQueue = new Queue<FastApiJobData>(FAST_API_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:fast-api"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});
