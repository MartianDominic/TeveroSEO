/**
 * GSC Sync Job Queue
 * Phase 96-01 Task 4: BullMQ queue for GSC sync orchestration
 *
 * Creates queue with:
 * - 50 req/min global rate limiting
 * - Daily 3 AM UTC repeatable job
 * - Exponential backoff on failures (3 attempts)
 */

import { Queue } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";

/**
 * Job data for GSC sync jobs.
 */
export interface GscSyncJobData {
  syncType: "full" | "incremental";
  siteId?: string; // Optional: sync specific site only
}

/**
 * Job result returned after sync completes.
 */
export interface GscSyncJobResult {
  sitesProcessed: number;
  totalRowsInserted: number;
  errors: string[];
  durationMs: number;
}

/**
 * GSC sync queue with rate limiting and retry configuration.
 */
export const gscSyncQueue = new Queue<GscSyncJobData, GscSyncJobResult>("gsc-sync", {
  connection: getSharedBullMQConnection("queue:gsc-sync"),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 }, // 24 hours, keep 1000 recent
    removeOnFail: { age: 604800, count: 5000 }, // 7 days, keep 5000 recent
  },
});

/**
 * Schedule daily full GSC sync at 3 AM UTC.
 * Idempotent: Uses jobId to prevent duplicate repeatable jobs.
 */
export async function scheduleGscSync(): Promise<void> {
  await gscSyncQueue.add(
    "full-sync",
    { syncType: "full" },
    {
      repeat: {
        pattern: "0 3 * * *", // 3 AM UTC daily
        tz: "UTC",
      },
      jobId: "gsc-full-sync-daily", // Prevents duplicates
    }
  );
}
