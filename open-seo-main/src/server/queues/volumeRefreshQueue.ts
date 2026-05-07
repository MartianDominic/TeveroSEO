/**
 * Volume Refresh Queue
 * Phase 93: Keyword Coverage Intelligence
 *
 * BullMQ queue for monthly volume refresh jobs.
 * Runs 1st of every month at 3 AM UTC per 93-RESEARCH.md.
 */
import { Queue } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

export const VOLUME_REFRESH_QUEUE_NAME = "volume-refresh";

export interface VolumeRefreshJobData {
  prospectId: string;
  triggeredBy: string;  // user_id or "system"
  locationCode?: number;  // Optional override, defaults to 2440 (Lithuania)
  languageCode?: string;  // Optional override, defaults to "lt"
}

export interface VolumeRefreshResult {
  prospectId: string;
  keywordsUpdated: number;
  keywordsSkipped: number;
  costUsd: number;
  processingTimeMs: number;
}

export const volumeRefreshQueue = new Queue<VolumeRefreshJobData>(
  VOLUME_REFRESH_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:volume-refresh"),
    defaultJobOptions: getStandardJobOptions({
      removeOnComplete: { age: 86400, count: 100 },  // Keep completed jobs for 24 hours
      removeOnFail: { age: 604800, count: 500 },     // Keep failed jobs for 7 days
    }),
  }
);

/**
 * Schedule monthly refresh for all prospects.
 * Called during worker startup.
 */
export async function scheduleMonthlyRefresh(): Promise<void> {
  // Add repeatable job: 3 AM UTC on 1st of every month
  // Job with name "monthly-global" will be deduplicated by BullMQ
  await volumeRefreshQueue.add(
    "monthly-global",
    {
      prospectId: "all",  // Special value: refresh all prospects
      triggeredBy: "system",
    },
    {
      repeat: {
        pattern: "0 3 1 * *",  // Cron: 3 AM on 1st of month
      },
      jobId: "monthly-volume-refresh",  // Prevent duplicates
    }
  );
}
