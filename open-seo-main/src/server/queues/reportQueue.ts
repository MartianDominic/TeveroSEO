/**
 * BullMQ Queue definition for report generation.
 *
 * - `reportQueue` - primary queue for PDF report generation jobs
 * - `enqueueReportGeneration` - helper to add jobs with proper options
 *
 * Job types:
 * - generate-report: Generate a PDF report for a client
 * - dlq:report-generation: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "reportQueue" });

export const REPORT_QUEUE_NAME = "report-generation" as const;

/**
 * Job data for report generation.
 */
export interface ReportJobData {
  reportId: string; // UUID from reports table
  clientId: string;
  reportType: string; // "monthly-seo", "weekly-summary"
  dateRange: { start: string; end: string };
  locale: string;
  contentHash: string;
}

/**
 * Dead-letter queue job data for failed report generation jobs.
 * Jobs moved here after exhausting all retry attempts for manual inspection.
 */
export interface ReportDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: ReportJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options for report generation.
 * Job timeout is controlled via Worker lockDuration (set to 90s in report-worker.ts).
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

/**
 * Report generation queue.
 * Uses shared BullMQ connection for Redis.
 */
export const reportQueue = new Queue<ReportJobData | ReportDLQJobData>(
  REPORT_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:report"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Enqueue a report generation job.
 *
 * @param reportId - UUID of the report record in the database
 * @param data - Report generation parameters
 */
export async function enqueueReportGeneration(
  reportId: string,
  data: Omit<ReportJobData, "reportId">,
): Promise<void> {
  await reportQueue.add(
    "generate-report",
    { reportId, ...data },
    {
      jobId: `report-${reportId}`,
      priority: 1,
    },
  );
  log.info("Report generation job queued", {
    reportId,
    clientId: data.clientId,
    reportType: data.reportType,
  });
}
