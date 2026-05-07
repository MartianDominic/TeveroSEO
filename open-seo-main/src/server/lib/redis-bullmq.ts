/**
 * BullMQ-specific Redis utilities.
 *
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !!! SERVER-ONLY FILE - DO NOT import in client-side code or routes        !!!
 * !!! Import from '@/server/lib/redis' for browser-safe Redis utilities     !!!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * This module provides:
 * - DRR Fair Queuing Integration (73-01)
 * - BullMQ-specific enqueue utilities
 *
 * @module redis-bullmq
 */

import { Queue, type Job, type JobsOptions } from "bullmq";
import { nanoid } from "nanoid";
import { redis } from "./redis";
import { DRRQueueManager } from "./queue/drr-queue";

// =============================================================================
// DRR Fair Queuing Integration (73-01)
// =============================================================================

/**
 * Singleton DRR queue manager for multi-tenant fair scheduling.
 *
 * Per docs/infra-research/crawling-10-5000-tasks-day.md:
 * > Fair queuing across `client_id` buckets uses Deficit Round Robin
 *
 * Initialized lazily on first use to ensure Redis connection is ready.
 */
let drrManager: DRRQueueManager | null = null;

/**
 * Get or create the singleton DRR queue manager.
 *
 * @returns DRRQueueManager instance
 */
export function getDRRManager(): DRRQueueManager {
  if (!drrManager) {
    drrManager = new DRRQueueManager(redis, {
      quantum: parseInt(process.env.DRR_QUANTUM ?? "100", 10),
      maxDeficit: parseInt(process.env.DRR_MAX_DEFICIT ?? "1000", 10),
      heavyClientThreshold: parseFloat(process.env.DRR_HEAVY_CLIENT_THRESHOLD ?? "0.3"),
    });
  }
  return drrManager;
}

/**
 * Job data interface for DRR-enabled queues.
 * All jobs must include clientId for fair scheduling.
 */
export interface DRRJobData {
  clientId: string;
  [key: string]: unknown;
}

/**
 * Result of enqueueWithFairness operation.
 */
export interface EnqueueResult<T> {
  job: Job<T>;
  drrJobId: string;
}

/**
 * Enqueue a job with DRR fair scheduling.
 *
 * Before adding to BullMQ, registers the job with the DRR manager
 * to enable fair dequeue ordering across clients.
 *
 * @param queue - BullMQ queue to add job to
 * @param jobName - Name of the job (for BullMQ)
 * @param jobData - Job data including required clientId
 * @param opts - Optional BullMQ job options
 * @returns EnqueueResult with BullMQ job and DRR job ID
 */
export async function enqueueWithFairness<T extends DRRJobData>(
  queue: Queue<T>,
  jobName: string,
  jobData: T,
  opts?: JobsOptions
): Promise<EnqueueResult<T>> {
  if (!jobData.clientId) {
    throw new Error("clientId is required for fair queuing");
  }

  const drr = getDRRManager();
  const drrJobId = nanoid();

  // Register with DRR for fair scheduling
  await drr.registerJob(jobData.clientId, drrJobId);

  // Add to BullMQ queue
  // BullMQ Queue.add() has complex generics for job names; using type assertion
  // since we accept any string job name
  const job = await (queue.add as unknown as (name: string, data: T, opts?: JobsOptions) => Promise<Job<T>>)(
    jobName,
    jobData,
    opts
  );

  return { job, drrJobId };
}

/**
 * Check and enforce heavy client limits.
 *
 * Call periodically (e.g., via cron job) to auto-reduce weight
 * for clients exceeding the daily volume threshold.
 *
 * @returns Array of client IDs that had their weight reduced
 */
export async function enforceHeavyClientLimits(): Promise<string[]> {
  const drr = getDRRManager();
  return drr.enforceHeavyClientLimits();
}

/**
 * Get DRR queue statistics for monitoring.
 *
 * @returns DRRStats with bucket counts and pending jobs
 */
export function getDRRStats() {
  const drr = getDRRManager();
  return drr.getStats();
}
