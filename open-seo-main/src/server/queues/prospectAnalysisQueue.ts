/**
 * BullMQ Queue definition for prospect analysis jobs.
 *
 * - `prospectAnalysisQueue` - primary queue for analysis jobs
 * - Jobs are submitted when user clicks "Analyze" button
 * - Rate limited to 10 analyses/day per workspace
 *
 * Job types:
 * - analyze-prospect: Run DataForSEO analysis on a prospect
 * - dlq:prospect-analysis: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db/index";
import { prospectAnalyses, prospects } from "@/db/prospect-schema";
import { eq, and, gte, count } from "drizzle-orm";
import {
  addJobWithBackpressure,
  generateJobId,
  QueueBackpressureError,
} from "@/server/lib/queue-utils";

const log = createLogger({ module: "prospectAnalysisQueue" });

export const PROSPECT_ANALYSIS_QUEUE_NAME = "prospect-analysis" as const;

/**
 * Analysis types available for prospects.
 */
export type ProspectAnalysisType = "quick_scan" | "deep_dive" | "opportunity_discovery";

/**
 * Job data for prospect analysis.
 */
export interface ProspectAnalysisJobData {
  prospectId: string;
  workspaceId: string;
  analysisType: ProspectAnalysisType;
  analysisId: string; // ID of the prospect_analyses record
  targetRegion?: string; // e.g., "US", "UK", "EU"
  targetLanguage?: string; // e.g., "en", "de"
  triggeredAt: string; // ISO timestamp
  triggeredBy: string; // User ID who triggered
}

/**
 * Dead-letter queue job data for failed analysis jobs.
 */
export interface ProspectAnalysisDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: ProspectAnalysisJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * 3 attempts with exponential backoff (10s, 20s, 40s).
 * Longer backoff than ranking since analysis involves multiple API calls.
 */
/**
 * Default job options for prospect analysis.
 * Job timeout is controlled via Worker lockDuration (set to 300s in prospect-analysis-worker.ts).
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

/**
 * Prospect analysis queue.
 * Uses shared BullMQ connection for Redis.
 */
export const prospectAnalysisQueue = new Queue<
  ProspectAnalysisJobData | ProspectAnalysisDLQJobData
>(PROSPECT_ANALYSIS_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:prospect-analysis"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Submit a prospect analysis job with backpressure protection.
 * Job ID uses prospectId + timestamp to prevent exact duplicates.
 *
 * @throws QueueBackpressureError if queue is at capacity
 */
export async function submitProspectAnalysis(
  data: ProspectAnalysisJobData,
): Promise<string> {
  const jobId = generateJobId("prospect", data.prospectId, true);

  await addJobWithBackpressure(
    prospectAnalysisQueue,
    "analyze-prospect",
    data,
    { jobId },
    { maxQueueSize: 1000, allowDegradedMode: true },
  );

  log.info("Prospect analysis job submitted", {
    jobId,
    prospectId: data.prospectId,
    analysisType: data.analysisType,
  });

  return jobId;
}

// Re-export for caller convenience
export { QueueBackpressureError };

/**
 * Get count of analyses run today for a workspace.
 * Used for rate limiting (max 10/day).
 *
 * Queries the database directly for efficiency (O(1) index lookup)
 * rather than scanning BullMQ jobs (O(n)).
 */
export async function getWorkspaceAnalysisCountToday(
  workspaceId: string,
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Query prospect_analyses joined with prospects to filter by workspace
  // Count all analyses created today (pending, running, completed, failed)
  const [result] = await db
    .select({ count: count() })
    .from(prospectAnalyses)
    .innerJoin(prospects, eq(prospectAnalyses.prospectId, prospects.id))
    .where(
      and(
        eq(prospects.workspaceId, workspaceId),
        gte(prospectAnalyses.createdAt, startOfDay),
      ),
    );

  return result?.count ?? 0;
}
